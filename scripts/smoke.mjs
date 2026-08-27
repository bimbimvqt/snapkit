import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adminBase = (process.env.ADMIN_URL ?? process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const backendBase = (process.env.BACKEND_URL ?? process.argv[3] ?? "http://localhost:3001").replace(/\/$/, "");

function readEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

const configuredEnvPath = process.env.SMOKE_ENV_FILE
  ? resolve(root, process.env.SMOKE_ENV_FILE)
  : resolve(root, "backend/.env.local");
const smokeEnv = readEnv(configuredEnvPath);
const email = process.env.ADMIN_EMAIL ?? smokeEnv.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD ?? smokeEnv.ADMIN_PASSWORD;

async function expectResponse(label, url, init, expected = 200) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(`${label}: expected ${expected}, received ${response.status}: ${body.slice(0, 300)}`);
  }
  console.log(`OK ${label} (${response.status})`);
  return response;
}

try {
  await expectResponse("backend health", `${backendBase}/api/health`);
  await expectResponse("public remote config", `${backendBase}/api/v1/config`);
  await expectResponse("admin login page", `${adminBase}/login`);

  if (!email || !password) throw new Error("Missing ADMIN_EMAIL or ADMIN_PASSWORD for authenticated smoke tests");
  const login = await expectResponse("admin login API", `${adminBase}/backend/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookies = typeof login.headers.getSetCookie === "function"
    ? login.headers.getSetCookie()
    : [login.headers.get("set-cookie")].filter(Boolean);
  const cookie = cookies.map((value) => value.split(";", 1)[0]).join("; ");
  if (!cookie.includes("tb_access=") || !cookie.includes("tb_refresh=")) {
    throw new Error("Login response did not return both auth cookies");
  }
  const refreshToken = cookie
    .split("; ")
    .find((value) => value.startsWith("tb_refresh="))
    ?.slice("tb_refresh=".length);

  const authenticated = { headers: { cookie }, redirect: "manual" };
  await expectResponse("current user", `${adminBase}/backend/api/v1/auth/me`, authenticated);
  await expectResponse("admin overview API", `${adminBase}/backend/api/admin/overview`, authenticated);
  await expectResponse("admin dashboard", `${adminBase}/admin`, authenticated);
  await expectResponse("logout", `${adminBase}/backend/api/v1/auth/logout`, { ...authenticated, method: "POST" });
  await expectResponse("revoked refresh token", `${adminBase}/backend/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  }, 401);
  console.log("Smoke test completed successfully.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
