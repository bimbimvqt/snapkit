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
  : resolve(root, "backend/.env");
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

async function expectAdminPage(label, path, authenticated) {
  const response = await expectResponse(label, `${adminBase}${path}`, authenticated);
  const body = await response.text();
  if (/Runtime TypeError|Application error|Internal Server Error/i.test(body)) {
    throw new Error(`${label}: rendered a server error page`);
  }
}

async function expectPlayableVideo(authenticated) {
  const response = await expectResponse(
    "admin video list",
    `${adminBase}/backend/api/admin/media-scans?pageSize=12&type=VIDEO`,
    authenticated,
  );
  const body = await response.json();
  let videos = body?.data?.assets?.items;
  let video = Array.isArray(videos) ? videos.find((item) => item?.hasPreview === true) : null;
  if (!video) {
    const group = Array.isArray(body?.data?.groups)
      ? body.data.groups.find((item) => item?.videoCount > 0)
      : null;
    if (group?.key && group.key !== body?.data?.selectedGroupKey) {
      const groupResponse = await expectResponse(
        "admin video owner",
        `${adminBase}/backend/api/admin/media-scans?pageSize=12&type=VIDEO&group=${encodeURIComponent(group.key)}`,
        authenticated,
      );
      const groupBody = await groupResponse.json();
      videos = groupBody?.data?.assets?.items;
      video = Array.isArray(videos) ? videos.find((item) => item?.hasPreview === true) : null;
    }
  }
  if (!video?.id) {
    console.log("SKIP admin video preview (no synchronized video)");
    return;
  }
  const previewUrl = `${adminBase}/backend/api/admin/media-scans/assets/${encodeURIComponent(video.id)}/preview`;
  let preview = await fetch(
    previewUrl,
    {
      ...authenticated,
      headers: { ...authenticated.headers, range: "bytes=0-1023" },
      signal: AbortSignal.timeout(30 * 60_000),
    },
  );
  if (preview.status === 302) {
    const location = preview.headers.get("location");
    if (!location) throw new Error("admin video preview: R2 redirect did not include a location");
    preview = await fetch(location, {
      headers: { range: "bytes=0-1023" },
      signal: AbortSignal.timeout(30 * 60_000),
    });
  }
  if (preview.status !== 206 || !preview.headers.get("content-type")?.startsWith("video/mp4")) {
    const errorBody = await preview.text();
    throw new Error(
      `admin video preview: expected playable MP4 range, received ${preview.status} ${preview.headers.get("content-type")}: ${errorBody.slice(0, 300)}`,
    );
  }
  console.log("OK admin video preview (206 video/mp4)");
}

try {
  const health = await expectResponse("backend health", `${backendBase}/api/health`);
  const healthBody = await health.json();
  if (smokeEnv.R2_REQUIRED === "true" && healthBody?.data?.objectStorage !== "r2") {
    throw new Error("backend health: R2_REQUIRED=true but Cloudflare R2 is not active");
  }
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
  if (!cookie.includes("snapkit_access=") || !cookie.includes("snapkit_refresh=")) {
    throw new Error("Login response did not return both auth cookies");
  }
  const refreshToken = cookie
    .split("; ")
    .find((value) => value.startsWith("snapkit_refresh="))
    ?.slice("snapkit_refresh=".length);

  const authenticated = { headers: { cookie }, redirect: "manual" };
  await expectResponse("current user", `${adminBase}/backend/api/v1/auth/me`, authenticated);
  await expectResponse("admin overview API", `${adminBase}/backend/api/admin/overview`, authenticated);
  await expectAdminPage("admin dashboard", "/admin", authenticated);
  await expectAdminPage("admin users", "/admin/users", authenticated);
  await expectAdminPage("admin QR", "/admin/qr", authenticated);
  await expectAdminPage("admin media scans", "/admin/media-scans", authenticated);
  await expectPlayableVideo(authenticated);
  await expectAdminPage("admin subscriptions", "/admin/subscriptions", authenticated);
  await expectAdminPage("admin config", "/admin/config", authenticated);
  await expectAdminPage("admin audit", "/admin/audit", authenticated);
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
