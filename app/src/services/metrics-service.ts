import { pool } from "../db/db";

export async function saveMetric(
    protocol: string,
    userId: string | null,
    result: string,
    durationMs: number
): Promise<void> {
    await pool.query(
        `
    INSERT INTO auth_metrics (protocol, user_id, result, duration_ms)
    VALUES ($1, $2, $3, $4)
    `,
        [protocol, userId, result, durationMs]
    );
}

export async function getMetrics() {
    const result = await pool.query(
        `
    SELECT id, protocol, user_id, result, duration_ms, created_at
    FROM auth_metrics
    ORDER BY id DESC
    `
    );

    return result.rows;
}