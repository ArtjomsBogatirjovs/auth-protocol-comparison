import { pool } from "../db/db";

export type StoredWebAuthnCredential = {
    id: string;
    userId: string;
    username: string;
    credentialID: string;
    credentialPublicKey: string;
    counter: number;
    transports: string[] | null;
};

export async function getCredentialByUsername(
    username: string
): Promise<StoredWebAuthnCredential | null> {
    const result = await pool.query(
        `
    SELECT
      id,
      user_id,
      username,
      credential_id,
      credential_public_key,
      counter,
      transports
    FROM webauthn_credentials
    WHERE username = $1
    ORDER BY id DESC
    LIMIT 1
    `,
        [username]
    );

    if (result.rowCount === 0) {
        return null;
    }

    const row = result.rows[0];

    return {
        id: String(row.id),
        userId: row.user_id,
        username: row.username,
        credentialID: row.credential_id,
        credentialPublicKey: row.credential_public_key,
        counter: row.counter,
        transports: row.transports ? JSON.parse(row.transports) : null,
    };
}

export async function getCredentialById(
    credentialId: string
): Promise<StoredWebAuthnCredential | null> {
    const result = await pool.query(
        `
    SELECT
      id,
      user_id,
      username,
      credential_id,
      credential_public_key,
      counter,
      transports
    FROM webauthn_credentials
    WHERE credential_id = $1
    LIMIT 1
    `,
        [credentialId]
    );

    if (result.rowCount === 0) {
        return null;
    }

    const row = result.rows[0];

    return {
        id: String(row.id),
        userId: row.user_id,
        username: row.username,
        credentialID: row.credential_id,
        credentialPublicKey: row.credential_public_key,
        counter: row.counter,
        transports: row.transports ? JSON.parse(row.transports) : null,
    };
}

export async function saveCredential(input: {
    userId: string;
    username: string;
    credentialID: string;
    credentialPublicKey: string;
    counter: number;
    transports?: string[];
}): Promise<void> {
    await pool.query(
        `
    INSERT INTO webauthn_credentials
      (user_id, username, credential_id, credential_public_key, counter, transports)
    VALUES
      ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (credential_id) DO UPDATE SET
      credential_public_key = EXCLUDED.credential_public_key,
      counter = EXCLUDED.counter,
      transports = EXCLUDED.transports
    `,
        [
            input.userId,
            input.username,
            input.credentialID,
            input.credentialPublicKey,
            input.counter,
            JSON.stringify(input.transports || []),
        ]
    );
}

export async function updateCredentialCounter(
    credentialId: string,
    counter: number
): Promise<void> {
    await pool.query(
        `
    UPDATE webauthn_credentials
    SET counter = $2
    WHERE credential_id = $1
    `,
        [credentialId, counter]
    );
}

export async function getAllWebAuthnCredentials(): Promise<StoredWebAuthnCredential[]> {
    const result = await pool.query(
        `
    SELECT
      id,
      user_id,
      username,
      credential_id,
      credential_public_key,
      counter,
      transports
    FROM webauthn_credentials
    ORDER BY id DESC
    `
    );

    return result.rows.map((row) => ({
        id: String(row.id),
        userId: row.user_id,
        username: row.username,
        credentialID: row.credential_id,
        credentialPublicKey: row.credential_public_key,
        counter: row.counter,
        transports: row.transports ? JSON.parse(row.transports) : null,
    }));
}