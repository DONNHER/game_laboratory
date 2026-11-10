import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Pool } from "pg";

const backendDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
loadDotenv({ path: path.join(backendDirectory, ".env.local") });

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations/001_game_profiles.sql"
);
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

async function migrate(): Promise<void> {
  if (!connectionString) {
    throw new Error("Set DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL before migrating.");
  }

  const pool = new Pool({ connectionString });
  try {
    await pool.query(await readFile(migrationPath, "utf8"));
    console.log("Applied backend/migrations/001_game_profiles.sql");
  } finally {
    await pool.end();
  }
}

void migrate().catch((error: unknown) => {
  console.error("Could not apply the game profile migration.", error);
  process.exitCode = 1;
});
