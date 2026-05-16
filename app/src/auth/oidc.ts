import dotenv from "dotenv";

dotenv.config();

type OpenIdClient = typeof import("openid-client");
type OidcConfiguration = import("openid-client").Configuration;

let oidcClient: OpenIdClient | null = null;
let oidcConfig: OidcConfiguration | null = null;

async function getOpenIdClient(): Promise<OpenIdClient> {
    if (oidcClient) {
        return oidcClient;
    }

    oidcClient = await new Function(
        "specifier",
        "return import(specifier)",
    )("openid-client") as OpenIdClient;

    return oidcClient;
}

function requiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Nav norādīts vides mainīgais: ${name}`);
    }

    return value;
}

export async function getOidcConfig(): Promise<OidcConfiguration> {
    if (oidcConfig) {
        return oidcConfig;
    }

    const client = await getOpenIdClient();

    oidcConfig = await client.discovery(
        new URL(requiredEnv("OIDC_ISSUER_URL")),
        requiredEnv("OIDC_CLIENT_ID"),
        requiredEnv("OIDC_CLIENT_SECRET"),
        undefined,
        {
            execute: [client.allowInsecureRequests],
        },
    );

    return oidcConfig;
}

export async function getOidcClient(): Promise<OpenIdClient> {
    return getOpenIdClient();
}

export function getOidcRedirectUri(): string {
    return requiredEnv("OIDC_REDIRECT_URI");
}

export function getOidcScopes(): string {
    return "openid profile email";
}