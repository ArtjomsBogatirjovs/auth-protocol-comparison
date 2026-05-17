import {pool} from "../db/db";

export type AuthMetricInput = {
    protocol: string;
    scenario: string;
    userId: string | null;
    result: string;
    durationMs: number;
    httpRequests: number;
    redirects: number;
    bytesTransferred: number;
    notes?: string;
};

export async function saveMetric(metric: AuthMetricInput): Promise<void> {
    await pool.query(
        `
            INSERT INTO auth_metrics
            (protocol, scenario, user_id, result, duration_ms, http_requests, redirects, bytes_transferred, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
            metric.protocol,
            metric.scenario,
            metric.userId,
            metric.result,
            metric.durationMs,
            metric.httpRequests,
            metric.redirects,
            metric.bytesTransferred,
            metric.notes || null,
        ]
    );
}

export async function getMetrics() {
    const result = await pool.query(`
        SELECT id,
               protocol,
               scenario,
               user_id,
               result,
               duration_ms,
               http_requests,
               redirects,
               bytes_transferred,
               notes,
               created_at
        FROM auth_metrics
        ORDER BY id DESC
    `);

    return result.rows;
}

export async function getMetricsSummary() {
    const result = await pool.query(`
        SELECT protocol,
               scenario,
               COUNT(*)                         AS runs,
               ROUND(AVG(duration_ms), 2)       AS avg_duration_ms,
               ROUND(
                       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric,
                       2
               )                                AS p95_duration_ms,
               MAX(duration_ms)                 AS max_duration_ms,
               ROUND(AVG(http_requests), 2)     AS avg_http_requests,
               ROUND(AVG(redirects), 2)         AS avg_redirects,
               ROUND(AVG(bytes_transferred), 2) AS avg_bytes_transferred,
               ROUND(
                       100.0 * SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END) / COUNT(*),
                       2
               )                                AS success_rate
        FROM auth_metrics
        GROUP BY protocol, scenario
        ORDER BY protocol, scenario
    `);

    return result.rows;
}

export async function clearMetrics(): Promise<void> {
    await pool.query(`DELETE FROM auth_metrics`);
}