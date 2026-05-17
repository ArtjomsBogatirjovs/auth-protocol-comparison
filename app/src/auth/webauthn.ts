import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
    AuthenticationResponseJSON,
    AuthenticatorTransportFuture,
    RegistrationResponseJSON,
} from "@simplewebauthn/server";
import dotenv from "dotenv";
import {
    getCredentialById,
    getCredentialByUsername,
    saveCredential,
    updateCredentialCounter,
} from "./webauthn-store";

dotenv.config();

function requiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Nav norādīts vides mainīgais: ${name}`);
    }

    return value;
}

const rpName = process.env.WEBAUTHN_RP_NAME || "Auth Protocol Comparison";
const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

export async function createRegistrationOptions(username: string) {
    const existingCredential = await getCredentialByUsername(username);

    return generateRegistrationOptions({
        rpName,
        rpID,
        userName: username,
        userID: new TextEncoder().encode(username),
        attestationType: "none",
        excludeCredentials: existingCredential
            ? [
                {
                    id: existingCredential.credentialID,
                    transports:
                        existingCredential.transports as AuthenticatorTransportFuture[],
                },
            ]
            : [],
        authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "preferred",
        },
    });
}

export async function verifyRegistration(
    username: string,
    expectedChallenge: string,
    response: RegistrationResponseJSON
) {
    const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
        return { verified: false };
    }

    const { credential } = verification.registrationInfo;

    await saveCredential({
        userId: username,
        username,
        credentialID: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey).toString("base64"),
        counter: credential.counter,
        transports: response.response.transports,
    });

    return { verified: true };
}

export async function createAuthenticationOptions(username: string) {
    const credential = await getCredentialByUsername(username);

    return generateAuthenticationOptions({
        rpID,
        userVerification: "preferred",
        allowCredentials: credential
            ? [
                {
                    id: credential.credentialID,
                    transports:
                        credential.transports as AuthenticatorTransportFuture[],
                },
            ]
            : [],
    });
}

export async function verifyAuthentication(
    expectedChallenge: string,
    response: AuthenticationResponseJSON
) {
    const credential = await getCredentialById(response.id);

    if (!credential) {
        return { verified: false, username: null };
    }

    const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
            id: credential.credentialID,
            publicKey: Buffer.from(credential.credentialPublicKey, "base64"),
            counter: credential.counter,
            transports:
                credential.transports as AuthenticatorTransportFuture[] | undefined,
        },
    });

    if (!verification.verified) {
        return { verified: false, username: null };
    }

    await updateCredentialCounter(
        credential.credentialID,
        verification.authenticationInfo.newCounter
    );

    return {
        verified: true,
        username: credential.username,
    };
}