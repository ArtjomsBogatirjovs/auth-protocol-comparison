import dotenv from "dotenv";
import {Browser, BrowserContext, chromium, Page, Response} from "playwright";
import {initDb} from "../db/db";
import {saveMetric} from "../services/metrics-service";

dotenv.config();

type Protocol = "OpenID Connect" | "SAML" | "WebAuthn";
type Scenario = "S1" | "S2" | "S3";

type ProtocolConfig = {
    protocol: Protocol;
    path: string;
};

type NetworkStats = {
    httpRequests: number;
    redirects: number;
    bytesTransferred: number;
};

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const RUNS = Number(process.env.EXPERIMENT_RUNS || 10);
const CONCURRENT_USERS = Number(process.env.EXPERIMENT_CONCURRENT_USERS || 10);

const KEYCLOAK_USERNAME = process.env.KEYCLOAK_TEST_USERNAME || "testuser";
const KEYCLOAK_PASSWORD = process.env.KEYCLOAK_TEST_PASSWORD || "testpass";

const protocols: ProtocolConfig[] = [
    {protocol: "OpenID Connect", path: "/auth/oidc"},
    {protocol: "SAML", path: "/auth/saml"},
    {protocol: "WebAuthn", path: "/auth/webauthn"},
];

function createNetworkStats(): NetworkStats {
    return {
        httpRequests: 0,
        redirects: 0,
        bytesTransferred: 0,
    };
}

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

function attachNetworkMeasurement(page: Page, stats: NetworkStats): void {
    page.on("request", () => {
        stats.httpRequests += 1;
    });

    page.on("response", async (response) => {
        const status = response.status();

        if (status >= 300 && status < 400) {
            stats.redirects += 1;
        }

        stats.bytesTransferred += await getResponseSize(response);
    });
}

async function loginInKeycloakIfNeeded(page: Page): Promise<void> {
    try {
        await page.waitForSelector("#username", {timeout: 5000});

        await page.fill("#username", KEYCLOAK_USERNAME);
        await page.fill("#password", KEYCLOAK_PASSWORD);

        await Promise.all([
            page.waitForLoadState("networkidle", {timeout: 30000}).catch(() => undefined),
            page.click("#kc-login"),
        ]);
    } catch {
    }
}

async function isProtectedPage(page: Page): Promise<boolean> {
    await page.waitForLoadState("networkidle", {timeout: 30000}).catch(() => undefined);
    return page.url().includes("/protected");
}

async function enableVirtualAuthenticator(context: BrowserContext, page: Page): Promise<void> {
    const client = await context.newCDPSession(page);

    await client.send("WebAuthn.enable");

    await client.send("WebAuthn.addVirtualAuthenticator", {
        options: {
            protocol: "ctap2",
            transport: "usb",
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
            automaticPresenceSimulation: true,
        },
    });
}

async function registerWebAuthnCredential(page: Page, username: string): Promise<void> {
    await page.goto(`${BASE_URL}/webauthn`, {
        waitUntil: "networkidle",
        timeout: 30000,
    });

    await page.fill("#username", username);

    await Promise.all([
        page.waitForResponse((response) =>
            response.url().includes("/auth/webauthn/register/verify")
        ),
        page.click("#registerButton"),
    ]);
}

async function runOidcOrSamlLogin(
    browser: Browser,
    config: ProtocolConfig,
    scenario: Scenario,
    runNumber: number
): Promise<void> {
    const context = await browser.newContext();
    const page = await context.newPage();

    const stats = createNetworkStats();
    attachNetworkMeasurement(page, stats);

    const startedAt = Date.now();

    try {
        await page.goto(`${BASE_URL}${config.path}`, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });

        await loginInKeycloakIfNeeded(page);

        await page.waitForURL("**/protected", {
            timeout: 30000,
        }).catch(() => undefined);

        const durationMs = Date.now() - startedAt;
        const success = await isProtectedPage(page);

        await saveMetric({
            protocol: config.protocol,
            scenario,
            userId: KEYCLOAK_USERNAME,
            result: success ? "success" : "failure",
            durationMs,
            httpRequests: stats.httpRequests,
            redirects: stats.redirects,
            bytesTransferred: stats.bytesTransferred,
            notes: `Automatizēts Keycloak login, atkārtojums ${runNumber}`,
        });

        console.log(
            `${scenario} | ${config.protocol} | run=${runNumber} | result=${success ? "success" : "failure"} | duration=${durationMs}ms | requests=${stats.httpRequests} | redirects=${stats.redirects} | bytes=${stats.bytesTransferred}`
        );
    } catch (error) {
        const durationMs = Date.now() - startedAt;

        await saveMetric({
            protocol: config.protocol,
            scenario,
            userId: KEYCLOAK_USERNAME,
            result: "failure",
            durationMs,
            httpRequests: stats.httpRequests,
            redirects: stats.redirects,
            bytesTransferred: stats.bytesTransferred,
            notes: `Eksperimenta kļūda: ${String(error)}`,
        });

        console.error(`${scenario} | ${config.protocol} | run=${runNumber} | failure`, error);
    } finally {
        await context.close();
    }
}

async function runWebAuthnLogin(
    browser: Browser,
    scenario: Scenario,
    runNumber: number
): Promise<void> {
    const context = await browser.newContext();
    const page = await context.newPage();

    await enableVirtualAuthenticator(context, page);

    const username = `webauthn_${scenario}_${runNumber}_${Date.now()}`;

    try {
        await registerWebAuthnCredential(page, username);
    } catch (error) {
        await saveMetric({
            protocol: "WebAuthn",
            scenario,
            userId: username,
            result: "failure",
            durationMs: 0,
            httpRequests: 0,
            redirects: 0,
            bytesTransferred: 0,
            notes: `WebAuthn reģistrācija neizdevās: ${String(error)}`,
        });

        await context.close();
        return;
    }

    const stats = createNetworkStats();
    attachNetworkMeasurement(page, stats);

    const startedAt = Date.now();

    try {
        await page.goto(`${BASE_URL}/webauthn`, {
            waitUntil: "networkidle",
            timeout: 30000,
        });

        await page.fill("#username", username);

        await Promise.all([
            page.waitForURL("**/protected", {timeout: 30000}).catch(() => undefined),
            page.click("#loginButton"),
        ]);

        const durationMs = Date.now() - startedAt;
        const success = await isProtectedPage(page);

        await saveMetric({
            protocol: "WebAuthn",
            scenario,
            userId: username,
            result: success ? "success" : "failure",
            durationMs,
            httpRequests: stats.httpRequests,
            redirects: stats.redirects,
            bytesTransferred: stats.bytesTransferred,
            notes: `WebAuthn login ar Chromium virtuālo autentifikatoru, atkārtojums ${runNumber}`,
        });

        console.log(
            `${scenario} | WebAuthn | run=${runNumber} | result=${success ? "success" : "failure"} | duration=${durationMs}ms | requests=${stats.httpRequests} | redirects=${stats.redirects} | bytes=${stats.bytesTransferred}`
        );
    } catch (error) {
        const durationMs = Date.now() - startedAt;

        await saveMetric({
            protocol: "WebAuthn",
            scenario,
            userId: username,
            result: "failure",
            durationMs,
            httpRequests: stats.httpRequests,
            redirects: stats.redirects,
            bytesTransferred: stats.bytesTransferred,
            notes: `WebAuthn login kļūda: ${String(error)}`,
        });

        console.error(`${scenario} | WebAuthn | run=${runNumber} | failure`, error);
    } finally {
        await context.close();
    }
}

async function runSingleProtocol(
    browser: Browser,
    config: ProtocolConfig,
    scenario: Scenario,
    runNumber: number
): Promise<void> {
    if (config.protocol === "WebAuthn") {
        await runWebAuthnLogin(browser, scenario, runNumber);
        return;
    }

    await runOidcOrSamlLogin(browser, config, scenario, runNumber);
}

async function runS1(browser: Browser): Promise<void> {
    console.log("Sāk S1 scenāriju: viena veiksmīga autentifikācija.");

    for (const config of protocols) {
        await runSingleProtocol(browser, config, "S1", 1);
    }
}

async function runS2(browser: Browser): Promise<void> {
    console.log(`Sāk S2 scenāriju: ${RUNS} atkārtotas autentifikācijas.`);

    for (const config of protocols) {
        for (let i = 1; i <= RUNS; i += 1) {
            await runSingleProtocol(browser, config, "S2", i);
        }
    }
}

async function runS3(browser: Browser): Promise<void> {
    console.log(
        `Sāk S3 scenāriju: ${CONCURRENT_USERS} paralēli autentifikācijas mēģinājumi.`
    );

    for (const config of protocols) {
        const tasks: Promise<void>[] = [];

        for (let i = 1; i <= CONCURRENT_USERS; i += 1) {
            tasks.push(runSingleProtocol(browser, config, "S3", i));
        }

        await Promise.all(tasks);
    }
}

async function main(): Promise<void> {
    await initDb();

    const browser = await chromium.launch({
        headless: true,
    });

    try {
        await runS1(browser);
        await runS2(browser);
        await runS3(browser);
    } finally {
        await browser.close();
    }

    console.log("Eksperimenta izpilde pabeigta.");
}

main().catch((error) => {
    console.error("Eksperimenta izpilde neizdevās:", error);
    process.exit(1);
});