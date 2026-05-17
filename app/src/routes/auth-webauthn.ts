import { Router } from "express";
import {
    createAuthenticationOptions,
    createRegistrationOptions,
    verifyAuthentication,
    verifyRegistration,
} from "../auth/webauthn";
import { getAllWebAuthnCredentials } from "../auth/webauthn-store";

const router = Router();

router.get("/auth/webauthn", (_req, res) => {
    res.redirect("/webauthn");
});

router.get("/webauthn", (_req, res) => {
    res.send(`
    <h1>WebAuthn</h1>

    <input id="username" value="${process.env.WEBAUTHN_TEST_USERNAME || "testuser"}" />
    <button id="registerButton">Register</button>
    <button id="loginButton">Login</button>

    <p>
      <a href="/webauthn/credentials">Skatīt WebAuthn credentials tabulu</a>
    </p>

    <pre id="result"></pre>

    <script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
    <script>
      const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;

      async function registerWebAuthn() {
        const username = document.getElementById("username").value;

        const optionsResponse = await fetch("/auth/webauthn/register/options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        });

        const options = await optionsResponse.json();
        const attestation = await startRegistration(options);

        const verificationResponse = await fetch("/auth/webauthn/register/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, attestation })
        });

        const verification = await verificationResponse.json();
        document.getElementById("result").textContent =
          JSON.stringify(verification, null, 2);
      }

      async function loginWebAuthn() {
        const username = document.getElementById("username").value;

        const optionsResponse = await fetch("/auth/webauthn/login/options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        });

        const options = await optionsResponse.json();
        const assertion = await startAuthentication(options);

        const verificationResponse = await fetch("/auth/webauthn/login/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assertion })
        });

        const verification = await verificationResponse.json();

        if (verification.verified) {
          window.location.href = "/protected";
        } else {
          document.getElementById("result").textContent =
            JSON.stringify(verification, null, 2);
        }
      }

      document.getElementById("registerButton").addEventListener("click", registerWebAuthn);
      document.getElementById("loginButton").addEventListener("click", loginWebAuthn);
    </script>
  `);
});

router.post("/auth/webauthn/register/options", async (req, res, next) => {
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

router.post("/auth/webauthn/register/verify", async (req, res, next) => {
    try {
        const username = req.body.username;
        const expectedChallenge = (req.session as any).webauthnRegistrationChallenge;

        if (!username || !expectedChallenge) {
            res.status(400).json({
                verified: false,
                error: "Trūkst reģistrācijas datu.",
            });
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

router.post("/auth/webauthn/login/options", async (req, res, next) => {
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

router.post("/auth/webauthn/login/verify", async (req, res, next) => {
    try {
        const expectedChallenge = (req.session as any).webauthnAuthenticationChallenge;

        if (!expectedChallenge) {
            res.status(400).json({
                verified: false,
                error: "Trūkst autentifikācijas challenge.",
            });
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

router.get("/webauthn/credentials", async (_req, res, next) => {
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
            <td style="max-width:260px;word-break:break-all;">${credential.credentialID}</td>
            <td style="max-width:320px;word-break:break-all;">${credential.credentialPublicKey}</td>
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
          body { font-family: Arial, sans-serif; margin: 24px; }
          table { border-collapse: collapse; width: 100%; }
          th, td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }
          th { background: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>WebAuthn credentials</h1>
        <p><a href="/webauthn">Atpakaļ uz WebAuthn testu</a></p>

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

export default router;