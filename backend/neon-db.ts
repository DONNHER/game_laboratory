import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

let pool: Pool | undefined;

export function getNeonPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Neon Postgres.");
  }

  if (!pool) {
    pool = new Pool({ connectionString });
    if (process.env.VERCEL) attachDatabasePool(pool);
    pool.on("error", (error) => {
      console.error("Neon Postgres pool error:", error);
    });
  }

  return pool;
}

export function getDatabaseName(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Neon Realtime.");
  }

  const databaseName = decodeURIComponent(new URL(connectionString).pathname.slice(1));
  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  return databaseName;
}
