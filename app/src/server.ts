import express from "express";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import {initDb} from "./db/db";
import {getMetrics, getMetricsSummary} from "./services/metrics-service";
import crypto from "crypto";
import {getOidcConfig, getOidcRedirectUri, getOidcScopes} from "./auth/oidc";
import passport from "passport";
import bodyParser from "body-parser";
import {createSamlStrategy} from "./auth/saml";
import {
    createAuthenticationOptions,
    createRegistrationOptions,
    verifyAuthentication,
    verifyRegistration,
} from "./auth/webauthn";
import { getAllWebAuthnCredentials } from "./auth/webauthn-store";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.use(
    session({
        secret: process.env.SESSION_SECRET || "dev_secret_change_me",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
        },
    })
);

app.use(bodyParser.urlencoded({extended: false}));

const samlStrategy = createSamlStrategy();
passport.use("saml", samlStrategy);

passport.serializeUser((user, done) => {
    done(null, user as any);
});

passport.deserializeUser((user, done) => {
    done(null, user as any);
});

app.use(passport.initialize());
app.use(passport.session());

type OpenIdClient = typeof import("openid-client");
type OidcConfiguration = import("openid-client").Configuration;

let oidcClient: OpenIdClient | null = null;

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

app.get("/", (_req, res) => {
    res.render("home");
});

app.get("/auth/saml",
    passport.authenticate("saml", {
        failureRedirect: "/",
    })
);

app.post(
    "/auth/saml/callback",
    passport.authenticate("saml", {
        failureRedirect: "/",
    }),
    (req, res) => {
        const samlUser = req.user as any;

        (req.session as any).user =
            samlUser?.email || samlUser?.nameId || samlUser?.id || "unknown_saml_user";

        (req.session as any).authType = "SAML";
        (req.session as any).samlNameId = samlUser?.nameId;
        (req.session as any).samlSessionIndex = samlUser?.sessionIndex;

        res.redirect("/protected");
    }
);

app.get("/auth/oidc", async (req, res, next) => {
    try {
        const client = await getOpenIdClient();
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

app.get("/auth/oidc/callback", async (req, res, next) => {
    try {
        const client = await getOpenIdClient();
        const config = await getOidcConfig();

        const expectedState = (req.session as any).oidcState;
        const codeVerifier = (req.session as any).oidcCodeVerifier;

        if (!expectedState || !codeVerifier) {
            res.status(400).send("OIDC sesijas dati nav atrasti.");
            return;
        }

        const currentUrl = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);

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

app.get("/webauthn", (_req, res) => {
    res.send(`
    <h1>WebAuthn</h1>
    <input id="username" value="${process.env.WEBAUTHN_TEST_USERNAME || "testuser"}" />
    <button id="registerButton">Register</button>
    <button id="loginButton">Login</button>
    <pre id="result"></pre>

    <script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
    <script>
      async function registerWebAuthn() {
        const username = document.getElementById("username").value;

        const optionsResponse = await fetch("/auth/webauthn/register/options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        });

        const options = await optionsResponse.json();

        const attestation = await SimpleWebAuthnBrowser.startRegistration({
          optionsJSON: options
        });

        const verificationResponse = await fetch("/auth/webauthn/register/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, attestation })
        });

        const verification = await verificationResponse.json();
        document.getElementById("result").textContent = JSON.stringify(verification, null, 2);
      }

      async function loginWebAuthn() {
        const username = document.getElementById("username").value;

        const optionsResponse = await fetch("/auth/webauthn/login/options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        });

        const options = await optionsResponse.json();

        const assertion = await SimpleWebAuthnBrowser.startAuthentication({
          optionsJSON: options
        });

        const verificationResponse = await fetch("/auth/webauthn/login/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assertion })
        });

        const verification = await verificationResponse.json();

        if (verification.verified) {
          window.location.href = "/protected";
        } else {
          document.getElementById("result").textContent = JSON.stringify(verification, null, 2);
        }
      }

      document.getElementById("registerButton").addEventListener("click", registerWebAuthn);
      document.getElementById("loginButton").addEventListener("click", loginWebAuthn);
    </script>
  `);
});

app.get("/auth/webauthn", (_req, res) => {
    res.redirect("/webauthn");
});

app.post("/auth/webauthn/register/options", async (req, res, next) => {
    try {
        const username =
            req.body.username || process.env.WEBAUTHN_TEST_USERNAME || "testuser";

        const options = await createRegistrationOptions(username);

        (req.session as any).webauthnRegistrationChallenge = options.challenge;
        (req.session as any).webauthnRegistrationUsername = username;

        res.json(options);
    } catch (error) {
        next(error);
    }
});

app.post("/auth/webauthn/register/verify", async (req, res, next) => {
    try {
        const username = req.body.username;
        const expectedChallenge = (req.session as any).webauthnRegistrationChallenge;

        if (!username || !expectedChallenge) {
            res.status(400).json({ verified: false, error: "Trūkst reģistrācijas datu." });
            return;
        }

        const result = await verifyRegistration(
            username,
            expectedChallenge,
            req.body.attestation
        );

        delete (req.session as any).webauthnRegistrationChallenge;
        delete (req.session as any).webauthnRegistrationUsername;

        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.post("/auth/webauthn/login/options", async (req, res, next) => {
    try {
        const username =
            req.body.username || process.env.WEBAUTHN_TEST_USERNAME || "testuser";

        const options = await createAuthenticationOptions(username);

        (req.session as any).webauthnAuthenticationChallenge = options.challenge;

        res.json(options);
    } catch (error) {
        next(error);
    }
});

app.post("/auth/webauthn/login/verify", async (req, res, next) => {
    try {
        const expectedChallenge =
            (req.session as any).webauthnAuthenticationChallenge;

        if (!expectedChallenge) {
            res.status(400).json({ verified: false, error: "Trūkst autentifikācijas challenge." });
            return;
        }

        const result = await verifyAuthentication(
            expectedChallenge,
            req.body.assertion
        );

        delete (req.session as any).webauthnAuthenticationChallenge;

        if (result.verified) {
            (req.session as any).user = result.username;
            (req.session as any).authType = "WebAuthn";
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.get("/protected", (req, res) => {
    const user = (req.session as any).user;
    const authType = (req.session as any).authType;

    if (!user) {
        return res.status(401).send("Nav autorizētas piekļuves");
    }

    res.render("protected", {user, authType});
});

app.get("/metrics", async (_req, res) => {
    const metrics = await getMetrics();
    res.json(metrics);
});

app.get("/logout", async (req, res, next) => {
    try {
        const authType = (req.session as any).authType;
        const idToken = (req.session as any).idToken;

        if (authType === "OpenID Connect") {
            const config = await getOidcConfig();
            const metadata = config.serverMetadata();
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

            return;
        }

        if (authType === "SAML") {
            (samlStrategy as any).logout(req, (error: Error | null, logoutUrl?: string) => {
                if (error) {
                    next(error);
                    return;
                }

                req.session.destroy(() => {
                    res.redirect(logoutUrl || "/");
                });
            });
            return;
        }

        req.session.destroy(() => {
            res.redirect("/");
        });
    } catch (error) {
        next(error);
    }
});

app.post("/logout/saml/callback", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.get("/metrics/summary", async (_req, res) => {
    const summary = await getMetricsSummary();
    res.json(summary);
});

async function start() {
    await initDb();

    app.listen(PORT, () => {
        console.log(`Serveris darbojas: http://localhost:${PORT}`);
    });
}

start().catch((error) => {
    console.error("Neizdevās palaist lietotni:", error);
});

app.get("/webauthn/credentials", async (_req, res, next) => {
    try {
        const credentials = await getAllWebAuthnCredentials();

        const rows = credentials
            .map((credential) => {
                const transports = credential.transports?.join(", ") || "-";

                return `
          <tr>
            <td>${credential.id}</td>
            <td>${credential.userId}</td>
            <td>${credential.username}</td>
            <td style="max-width: 260px; word-break: break-all;">${credential.credentialID}</td>
            <td style="max-width: 320px; word-break: break-all;">${credential.credentialPublicKey}</td>
            <td>${credential.counter}</td>
            <td>${transports}</td>
          </tr>
        `;
            })
            .join("");

        res.send(`
      <!doctype html>
      <html lang="lv">
      <head>
        <meta charset="utf-8" />
        <title>WebAuthn credentials</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 24px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f2f2f2;
          }
          code {
            word-break: break-all;
          }
          a {
            display: inline-block;
            margin-bottom: 16px;
          }
        </style>
      </head>
      <body>
        <h1>WebAuthn credentials</h1>
        <a href="/webauthn">Atpakaļ uz WebAuthn testu</a>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User ID</th>
              <th>Username</th>
              <th>Credential ID</th>
              <th>Public key</th>
              <th>Counter</th>
              <th>Transports</th>
            </tr>
          </thead>
          <tbody>
            ${
            rows ||
            `<tr><td colspan="7">WebAuthn credentials vēl nav reģistrēti.</td></tr>`
        }
          </tbody>
        </table>
      </body>
      </html>
    `);
    } catch (error) {
        next(error);
    }
});