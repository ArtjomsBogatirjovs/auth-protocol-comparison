import express from "express";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import passport from "passport";

import { initDb } from "./db/db";
import { samlStrategy } from "./auth/saml";
import {clearMetrics, getMetrics, getMetricsSummary} from "./services/metrics-service";

import indexRoutes from "./routes/index";
import protectedRoutes from "./routes/protected";
import oidcRoutes from "./routes/auth-oidc";
import samlRoutes from "./routes/auth-saml";
import webauthnRoutes from "./routes/auth-webauthn";

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

passport.use("saml", samlStrategy);

passport.serializeUser((user, done) => {
    done(null, user as any);
});

passport.deserializeUser((user, done) => {
    done(null, user as any);
});

app.use(passport.initialize());
app.use(passport.session());

app.use(indexRoutes);
app.use(protectedRoutes);
app.use(oidcRoutes);
app.use(samlRoutes);
app.use(webauthnRoutes);

app.get("/logout", (req, res) => {
    const authType = (req.session as any).authType;

    if (authType === "OpenID Connect") {
        res.redirect("/logout/oidc");
        return;
    }

    if (authType === "SAML") {
        res.redirect("/logout/saml");
        return;
    }

    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.get("/metrics", async (_req, res, next) => {
    try {
        const metrics = await getMetrics();
        res.json(metrics);
    } catch (error) {
        next(error);
    }
});

app.get("/metrics/summary", async (_req, res, next) => {
    try {
        const summary = await getMetricsSummary();
        res.json(summary);
    } catch (error) {
        next(error);
    }
});

app.post("/metrics/clear", async (_req, res, next) => {
    try {
        await clearMetrics();
        res.json({ cleared: true });
    } catch (error) {
        next(error);
    }
});

async function start(): Promise<void> {
    await initDb();

    app.listen(PORT, () => {
        console.log(`Serveris darbojas: http://localhost:${PORT}`);
    });
}

start().catch((error) => {
    console.error("Servera palaišana neizdevās:", error);
    process.exit(1);
});