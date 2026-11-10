import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createRealtime, rawSql } from "@neon/realtime/server";
import { errors, createRemoteJWKSet, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import type {
  Request,
  RequestHandler,
  Response,
} from "express";
import express from "express";
import { getDatabaseName, getNeonPool } from "./neon-db.js";

const ASSET_BUCKET = "assets";
const AVATAR_MAX_BYTES = 3 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const GAME_MODES = new Set(["SOLO", "AI_RIVAL", "ONLINE_MATCH"]);
const CHARACTER_ID = /^[a-z0-9_-]{2,32}$/;

interface AuthenticatedRequest extends Request {
  neonUserId?: string;
}

interface GameProfile {
  user_id: string;
  display_name: string;
  unlocked_level: number;
  best_stars: Record<string, number>;
  high_distance: number;
  total_coins: number;
  selected_character_id: string;
  avatar_key: string | null;
  updated_at: string;
}

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  high_distance: number;
  total_coins: number;
  updated_at: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let s3Client: S3Client | undefined;
let realtime: ReturnType<typeof createRealtime> | undefined;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
  if (!jwksUrl) {
    throw new Error("NEON_AUTH_JWKS_URL is required for Neon Auth.");
  }
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
  }
  return jwks;
}

function getS3Client(): S3Client {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION } =
    process.env;
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_ENDPOINT_URL_S3 || !AWS_REGION) {
    throw new Error("Neon Object Storage credentials are missing from the backend environment.");
  }

  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: AWS_ENDPOINT_URL_S3,
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

function getRealtime() {
  const secret = process.env.NEON_REALTIME_SECRET;
  if (!secret) {
    throw new Error("NEON_REALTIME_SECRET is required for Neon Realtime.");
  }
  realtime ??= createRealtime({ secret, db: getDatabaseName() });
  return realtime;
}

function asyncRoute(
  handler: (request: Request, response: Response) => Promise<void>
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}

const requireNeonUser: RequestHandler = (request, response, next) => {
  const authRequest = request as AuthenticatedRequest;
  const authorization = request.header("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    response.status(401).json({ error: "Sign in to access your Neon profile." });
    return;
  }

  const issuer = process.env.NEON_AUTH_BASE_URL;
  if (!issuer) {
    next(new Error("NEON_AUTH_BASE_URL is required for Neon Auth."));
    return;
  }

  void jwtVerify(token, getJwks(), { issuer })
    .then(({ payload }) => {
      if (!payload.sub) {
        response.status(401).json({ error: "The sign-in token has no user identity." });
        return;
      }
      authRequest.neonUserId = payload.sub;
      next();
    })
    .catch((error: unknown) => {
      if (error instanceof errors.JOSEError) {
        response.status(401).json({ error: "The sign-in token is invalid or expired." });
        return;
      }
      next(error);
    });
};

function getUserId(request: Request): string {
  const userId = (request as AuthenticatedRequest).neonUserId;
  if (!userId) {
    throw new Error("Authenticated user identity is missing.");
  }
  return userId;
}

function sanitizeDisplayName(value: unknown): string {
  if (typeof value !== "string") return "Runner";
  return value.trim().replace(/\s+/g, " ").slice(0, 24) || "Runner";
}

function validStars(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [level, stars] of Object.entries(value)) {
    if (/^[1-5]$/.test(level) && Number.isInteger(stars) && Number(stars) >= 0 && Number(stars) <= 3) {
      result[level] = Number(stars);
    }
  }
  return result;
}

function safeInteger(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : fallback;
}

function objectBody(request: Request, response: Response): Record<string, unknown> | null {
  const body: unknown = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    response.status(400).json({ error: "A JSON request body is required." });
    return null;
  }
  return body as Record<string, unknown>;
}

async function profileWithAvatarUrl(profile: GameProfile) {
  const avatarUrl = profile.avatar_key
    ? await getSignedUrl(
        getS3Client(),
        new GetObjectCommand({
          Bucket: ASSET_BUCKET,
          Key: profile.avatar_key,
        }),
        { expiresIn: 900 }
      )
    : null;
  return { ...profile, avatar_url: avatarUrl };
}

function mergeBestStarsSql(): string {
  return `COALESCE((
    SELECT jsonb_object_agg(
      star_level,
      GREATEST(
        COALESCE((game_profiles.best_stars ->> star_level)::integer, 0),
        COALESCE((EXCLUDED.best_stars ->> star_level)::integer, 0)
      )
    )
    FROM jsonb_object_keys(game_profiles.best_stars || EXCLUDED.best_stars) AS levels(star_level)
  ), '{}'::jsonb)`;
}

function upsertProfileSql(): string {
  return `INSERT INTO game_profiles (
    user_id, display_name, unlocked_level, best_stars, high_distance,
    total_coins, selected_character_id
  ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    unlocked_level = GREATEST(game_profiles.unlocked_level, EXCLUDED.unlocked_level),
    best_stars = ${mergeBestStarsSql()},
    high_distance = GREATEST(game_profiles.high_distance, EXCLUDED.high_distance),
    total_coins = GREATEST(game_profiles.total_coins, EXCLUDED.total_coins),
    selected_character_id = EXCLUDED.selected_character_id,
    updated_at = now()
  RETURNING user_id, display_name, unlocked_level, best_stars, high_distance,
    total_coins, selected_character_id, avatar_key, updated_at`;
}

export function mountNeonRoutes(app: import("express").Express): void {
  app.get(
    "/api/neon/profile",
    requireNeonUser,
    asyncRoute(async (request, response) => {
      const userId = getUserId(request);
      const { rows } = await getNeonPool().query<GameProfile>(
        `INSERT INTO game_profiles (user_id, display_name)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING user_id, display_name, unlocked_level, best_stars, high_distance,
           total_coins, selected_character_id, avatar_key, updated_at`,
        [userId, "Runner"]
      );
      const isNew = rows.length > 0;
      const profile = rows[0] ?? (
        await getNeonPool().query<GameProfile>(
          `SELECT user_id, display_name, unlocked_level, best_stars, high_distance,
             total_coins, selected_character_id, avatar_key, updated_at
           FROM game_profiles WHERE user_id = $1`,
          [userId]
        )
      ).rows[0];
      response.json({ ...(await profileWithAvatarUrl(profile)), is_new: isNew });
    })
  );

  app.put(
    "/api/neon/profile",
    requireNeonUser,
    asyncRoute(async (request, response) => {
      const body = objectBody(request, response);
      if (!body) return;
      const { rows } = await getNeonPool().query<GameProfile>(upsertProfileSql(), [
        getUserId(request),
        sanitizeDisplayName(body.displayName),
        safeInteger(body.unlockedLevel, 1, 1, 5),
        JSON.stringify(validStars(body.bestStars)),
        safeInteger(body.highDistance, 0, 0, 2_000_000_000),
        safeInteger(body.totalCoins, 0, 0, 2_000_000_000),
        typeof body.selectedCharacterId === "string" && CHARACTER_ID.test(body.selectedCharacterId)
          ? body.selectedCharacterId
          : "kai",
      ]);
      const profile = rows[0];
      response.json(await profileWithAvatarUrl(profile));
    })
  );

  app.put(
    "/api/neon/profile/avatar",
    requireNeonUser,
    (request, response, next) => {
      expressRawAvatar(request, response, next);
    },
    asyncRoute(async (request, response) => {
      const contentType = request.header("content-type")?.split(";")[0]?.trim().toLowerCase();
      const body = request.body;
      if (!contentType || !AVATAR_TYPES.has(contentType) || !Buffer.isBuffer(body) || body.length === 0) {
        response.status(400).json({ error: "Choose a non-empty PNG, JPEG, or WebP image." });
        return;
      }
      if (body.length > AVATAR_MAX_BYTES) {
        response.status(413).json({ error: "Profile images must be 3 MB or smaller." });
        return;
      }

      const userId = getUserId(request);
      const key = `avatars/${encodeURIComponent(userId)}/${randomUUID()}`;
      const s3 = getS3Client();
      await s3.send(
        new PutObjectCommand({
          Bucket: ASSET_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );

      const client = await getNeonPool().connect();
      let oldKey: string | null = null;
      try {
        await client.query("BEGIN");
        const previous = await client.query<{ avatar_key: string | null }>(
          "SELECT avatar_key FROM game_profiles WHERE user_id = $1 FOR UPDATE",
          [userId]
        );
        oldKey = previous.rows[0]?.avatar_key ?? null;
        await client.query<{ avatar_key: string | null }>(
          `INSERT INTO game_profiles (user_id, display_name, avatar_key)
           VALUES ($1, 'Runner', $2)
           ON CONFLICT (user_id) DO UPDATE SET avatar_key = EXCLUDED.avatar_key, updated_at = now()
           RETURNING avatar_key`,
          [userId, key]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        await s3.send(new DeleteObjectCommand({ Bucket: ASSET_BUCKET, Key: key }));
        throw error;
      } finally {
        client.release();
      }

      const profile = (
        await getNeonPool().query<GameProfile>(
          `SELECT user_id, display_name, unlocked_level, best_stars, high_distance,
             total_coins, selected_character_id, avatar_key, updated_at
           FROM game_profiles WHERE user_id = $1`,
          [userId]
        )
      ).rows[0];
      if (oldKey && oldKey !== key) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: ASSET_BUCKET, Key: oldKey }));
        } catch (error) {
          console.error("Could not remove the previous profile image:", error);
        }
      }
      response.json(await profileWithAvatarUrl(profile));
    })
  );

  app.post(
    "/api/neon/game-runs",
    requireNeonUser,
    asyncRoute(async (request, response) => {
      const body = objectBody(request, response);
      if (!body) return;
      const runId = typeof body.runId === "string" && /^[0-9a-f-]{36}$/i.test(body.runId)
        ? body.runId
        : "";
      const mode = typeof body.mode === "string" ? body.mode : "";
      if (!runId || !GAME_MODES.has(mode)) {
        response.status(400).json({ error: "A valid run ID and game mode are required." });
        return;
      }

      const userId = getUserId(request);
      const client = await getNeonPool().connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "INSERT INTO game_profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
          [userId, sanitizeDisplayName(body.displayName)]
        );
        const inserted = await client.query(
          `INSERT INTO game_runs (run_id, user_id, mode, level_id, distance, coins, won, stars)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (run_id) DO NOTHING
           RETURNING run_id`,
          [
            runId,
            userId,
            mode,
            safeInteger(body.levelId, 1, 1, 5),
            safeInteger(body.distance, 0, 0, 2_000_000_000),
            safeInteger(body.coins, 0, 0, 2_000_000_000),
            body.won === true,
            safeInteger(body.stars, 0, 0, 3),
          ]
        );
        if (inserted.rowCount) {
          await client.query(upsertProfileSql(), [
            userId,
            sanitizeDisplayName(body.displayName),
            safeInteger(body.unlockedLevel, 1, 1, 5),
            JSON.stringify(validStars(body.bestStars)),
            safeInteger(body.highDistance, 0, 0, 2_000_000_000),
            safeInteger(body.totalCoins, 0, 0, 2_000_000_000),
            typeof body.selectedCharacterId === "string" && CHARACTER_ID.test(body.selectedCharacterId)
              ? body.selectedCharacterId
              : "kai",
          ]);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      response.status(202).json({ saved: true });
    })
  );

  app.get(
    "/api/neon/leaderboard/live-query",
    requireNeonUser,
    asyncRoute(async (_request, response) => {
      const query = rawSql<LeaderboardRow>(
        `SELECT user_id, display_name, high_distance, total_coins, updated_at
         FROM game_profiles
         ORDER BY high_distance DESC, updated_at DESC
         LIMIT 20`
      );
      response.json(await getRealtime().seal({ query }));
    })
  );
}

const expressRawAvatar: RequestHandler = express.raw({
  type: Array.from(AVATAR_TYPES),
  limit: AVATAR_MAX_BYTES,
});
