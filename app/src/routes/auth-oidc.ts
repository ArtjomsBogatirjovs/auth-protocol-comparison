import { Router } from "express";
import crypto from "crypto";
import {
    getOidcClient,
    getOidcConfig,
    getOidcRedirectUri,
    getOidcScopes,
} from "../auth/oidc";

const router = Router();

router.get("/auth/oidc", async (req, res, next) => {
    try {
        const client = await getOidcClient();
        const config = await getOidcConfig();

        const state = crypto.randomBytes(16).toString("hex");
        const codeVerifier = client.randomPKCECodeVerifier();
        const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

        (req.session as any).oidcState = state;
        (req.session as any).oidcCodeVerifier = codeVerifier;

        const authorizationUrl = client.buildAuthorizationUrl(config, {
            redirect_uri: getOidcRedirectUri(),
            scope: getOidcScopes(),
            state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
        });

        res.redirect(authorizationUrl.href);
    } catch (error) {
        next(error);
    }
});

router.get("/auth/oidc/callback", async (req, res, next) => {
    try {
        const client = await getOidcClient();
        const config = await getOidcConfig();

        const expectedState = (req.session as any).oidcState;
        const codeVerifier = (req.session as any).oidcCodeVerifier;

        if (!expectedState || !codeVerifier) {
            res.status(400).send("OIDC sesijas dati nav atrasti.");
            return;
        }

        const currentUrl = new URL(
            `${req.protocol}://${req.get("host")}${req.originalUrl}`
        );

        const tokens = await client.authorizationCodeGrant(config, currentUrl, {
            expectedState,
            pkceCodeVerifier: codeVerifier,
        });

        const claims = tokens.claims();

        (req.session as any).user = claims?.sub || "unknown_oidc_user";
        (req.session as any).authType = "OpenID Connect";
        (req.session as any).idToken = tokens.id_token;
        (req.session as any).accessToken = tokens.access_token;

        delete (req.session as any).oidcState;
        delete (req.session as any).oidcCodeVerifier;

        res.redirect("/protected");
    } catch (error) {
        next(error);
    }
});

router.get("/logout/oidc", async (req, res, next) => {
    try {
        const config = await getOidcConfig();
        const metadata = config.serverMetadata();

        const idToken = (req.session as any).idToken;
        const endSessionEndpoint = metadata.end_session_endpoint;
        const postLogoutRedirectUri =
            process.env.OIDC_LOGOUT_REDIRECT_URI || "http://localhost:3000/";

        let logoutUrl: string | null = null;

        if (endSessionEndpoint) {
            const url = new URL(endSessionEndpoint);

            if (idToken) {
                url.searchParams.set("id_token_hint", idToken);
            }

            url.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
            logoutUrl = url.href;
        }

        req.session.destroy(() => {
            res.redirect(logoutUrl || "/");
        });
    } catch (error) {
        next(error);
    }
});

export default router;