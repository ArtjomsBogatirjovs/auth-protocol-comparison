import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {Profile, Strategy as SamlStrategy, VerifiedCallback} from "passport-saml";

dotenv.config();

function requiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Nav norādīts vides mainīgais: ${name}`);
    }

    return value;
}

function readCertificate(): string {
    const certPath = requiredEnv("SAML_CERT_PATH");
    const absolutePath = path.resolve(process.cwd(), certPath);

    return fs.readFileSync(absolutePath, "utf8");
}

export const samlStrategy = new SamlStrategy(
    {
        entryPoint: requiredEnv("SAML_ENTRY_POINT"),
        logoutUrl: requiredEnv("SAML_LOGOUT_URL"),
        callbackUrl: requiredEnv("SAML_CALLBACK_URL"),
        logoutCallbackUrl: requiredEnv("SAML_LOGOUT_CALLBACK_URL"),
        issuer: requiredEnv("SAML_ISSUER"),
        cert: readCertificate(),
        identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
        acceptedClockSkewMs: 5000,
        wantAssertionsSigned: true,
        disableRequestedAuthnContext: true,
    },
    (profile: Profile | null | undefined, done: VerifiedCallback) => {
        if (!profile) {
            return done(new Error("SAML profils nav saņemts."));
        }

        return done(null, {
            id: profile.nameID,
            nameID: profile.nameID,
            nameId: profile.nameID,
            sessionIndex: profile.sessionIndex,
            email:
                (profile as any).email ||
                (profile as any).mail ||
                (profile as any)["urn:oid:1.2.840.113549.1.9.1"],
            rawProfile: profile,
        });
    }
);
