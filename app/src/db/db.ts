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
    console.log({
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD_LENGTH: process.env.DB_PASSWORD?.length,
        DB_PASSWORD_CODES: process.env.DB_PASSWORD
            ?.split("")
            .map((c) => c.charCodeAt(0)),
    });

    await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_metrics (
            id SERIAL PRIMARY KEY,
            protocol VARCHAR(50) NOT NULL,
            scenario VARCHAR(50) NOT NULL,
            user_id VARCHAR(255),
            result VARCHAR(50) NOT NULL,
            duration_ms INTEGER NOT NULL,
            http_requests INTEGER NOT NULL,
            redirects INTEGER NOT NULL,
            bytes_transferred INTEGER NOT NULL,
            notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
  `);
}