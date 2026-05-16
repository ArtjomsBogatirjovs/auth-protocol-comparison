import dotenv from "dotenv";
import { chromium, Response } from "playwright";
import { initDb } from "../db/db";
import { saveMetric } from "../services/metrics-service";

dotenv.config();

type ProtocolConfig = {
    protocol: "SAML" | "OpenID Connect" | "WebAuthn";
    path: string;
};

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const RUNS = Number(process.env.EXPERIMENT_RUNS || 10);

const protocols: ProtocolConfig[] = [
    { protocol: "SAML", path: "/auth/saml" },
    { protocol: "OpenID Connect", path: "/auth/oidc" },
    { protocol: "WebAuthn", path: "/auth/webauthn" },
];

async function getResponseSize(response: Response): Promise<number> {
    const contentLength = response.headers()["content-length"];

    if (contentLength && !Number.isNaN(Number(contentLength))) {
        return Number(contentLength);
    }

    try {
        const body = await response.body();
        return body.length;
    } catch {
        return 0;
    }
}

async function runSingleExperiment(config: ProtocolConfig, runNumber: number): Promise<void> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    let httpRequests = 0;
    let redirects = 0;
    let bytesTransferred = 0;

    page.on("request", () => {
        httpRequests += 1;
    });

    page.on("response", async (response) => {
        const status = response.status();

        if (status >= 300 && status < 400) {
            redirects += 1;
        }

        bytesTransferred += await getResponseSize(response);
    });

    const startedAt = Date.now();

    try {
        await page.goto(`${BASE_URL}${config.path}`, {
            waitUntil: "networkidle",
            timeout: 30000,
        });

        const durationMs = Date.now() - startedAt;
        const pageContent = await page.textContent("body");
        const isSuccess =
            page.url().includes("/protected") &&
            Boolean(pageContent && pageContent.length > 0);

        await saveMetric({
            protocol: config.protocol,
            scenario: "S1",
            userId: null,
            result: isSuccess ? "success" : "failure",
            durationMs,
            httpRequests,
            redirects,
            bytesTransferred,
            notes: `Playwright mērījums, atkārtojums ${runNumber}`,
        });

        console.log(
            `${config.protocol} | run=${runNumber} | result=${isSuccess ? "success" : "failure"} | ` +
            `duration=${durationMs}ms | requests=${httpRequests} | redirects=${redirects} | bytes=${bytesTransferred}`
        );
    } catch (error) {
        const durationMs = Date.now() - startedAt;

        await saveMetric({
            protocol: config.protocol,
            scenario: "S1",
            userId: null,
            result: "failure",
            durationMs,
            httpRequests,
            redirects,
            bytesTransferred,
            notes: `Eksperimenta kļūda: ${String(error)}`,
        });

        console.error(`${config.protocol} | run=${runNumber} | failure`, error);
    } finally {
        await browser.close();
    }
}

async function main(): Promise<void> {
    await initDb();

    for (const config of protocols) {
        for (let i = 1; i <= RUNS; i += 1) {
            await runSingleExperiment(config, i);
        }
    }

    console.log("Eksperimenta izpilde pabeigta.");
}

main().catch((error) => {
    console.error("Eksperimenta izpilde neizdevās:", error);
    process.exit(1);
});