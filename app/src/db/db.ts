import {Pool} from "pg";
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
        CREATE TABLE IF NOT EXISTS auth_metrics
        (
            id
            SERIAL
            PRIMARY
            KEY,
            protocol
            VARCHAR
        (
            50
        ) NOT NULL,
            scenario VARCHAR
        (
            50
        ) NOT NULL,
            user_id VARCHAR
        (
            255
        ),
            result VARCHAR
        (
            50
        ) NOT NULL,
            duration_ms INTEGER NOT NULL,
            http_requests INTEGER NOT NULL,
            redirects INTEGER NOT NULL,
            bytes_transferred INTEGER NOT NULL,
            notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS webauthn_credentials
        (
            id
            SERIAL
            PRIMARY
            KEY,
            user_id
            VARCHAR
        (
            255
        ) NOT NULL,
            username VARCHAR
        (
            255
        ) NOT NULL,
            credential_id TEXT NOT NULL UNIQUE,
            credential_public_key TEXT NOT NULL,
            counter INTEGER NOT NULL DEFAULT 0,
            transports TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
    `);
}