import express from "express";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import { initDb } from "./db/db";
import { getMetrics, saveMetric } from "./services/metrics-service";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
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

app.get("/", (_req, res) => {
    res.render("home");
});

app.get("/auth/saml", async (req, res) => {
    const startedAt = Date.now();

    (req.session as any).user = "saml_test_user";
    (req.session as any).authType = "SAML";

    const durationMs = Date.now() - startedAt;
    await saveMetric("SAML", "saml_test_user", "success", durationMs);

    res.redirect("/protected");
});

app.get("/auth/oidc", async (req, res) => {
    const startedAt = Date.now();

    (req.session as any).user = "oidc_test_user";
    (req.session as any).authType = "OpenID Connect";

    const durationMs = Date.now() - startedAt;
    await saveMetric("OpenID Connect", "oidc_test_user", "success", durationMs);

    res.redirect("/protected");
});

app.get("/auth/webauthn", async (req, res) => {
    const startedAt = Date.now();

    (req.session as any).user = "webauthn_test_user";
    (req.session as any).authType = "WebAuthn";

    const durationMs = Date.now() - startedAt;
    await saveMetric("WebAuthn", "webauthn_test_user", "success", durationMs);

    res.redirect("/protected");
});

app.get("/protected", (req, res) => {
    const user = (req.session as any).user;
    const authType = (req.session as any).authType;

    if (!user) {
        return res.status(401).send("Nav autorizētas piekļuves");
    }

    res.render("protected", { user, authType });
});

app.get("/metrics", async (_req, res) => {
    const metrics = await getMetrics();
    res.json(metrics);
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
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