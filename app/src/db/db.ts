import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

export async function initDb(): Promise<void> {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_metrics (
      id SERIAL PRIMARY KEY,
      protocol VARCHAR(50) NOT NULL,
      user_id VARCHAR(255),
      result VARCHAR(50) NOT NULL,
      duration_ms INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}