import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2];
const force = process.argv.includes("--force");

const paths = {
  root: resolve(root, ".env"),
  admin: resolve(root, "admin/.env.local"),
  backend: resolve(root, "backend/.env"),
  production: resolve(root, ".env.prod"),
};

function parse(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function readEnv(path) {
  return existsSync(path) ? parse(readFileSync(path, "utf8")) : {};
}

function serialize(values, heading) {
  return `${heading}\n${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
}

function ensureKeys(path, defaults, heading) {
  const current = readEnv(path);
  const next = { ...defaults, ...current };
  const missing = Object.keys(defaults).filter((key) => !(key in current));

  if (!existsSync(path) || missing.length > 0) {
    writeFileSync(path, serialize(next, heading), { mode: 0o600 });
    console.log(
      `Updated ${path.replace(`${root}/`, "")} (${missing.length || "new"} keys added)`,
    );
  } else {
    console.log(`Ready ${path.replace(`${root}/`, "")}`);
  }
  chmodSync(path, 0o600);
}

function keepOnlyKeys(path, defaults, heading) {
  const current = readEnv(path);
  const next = Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      current[key] ?? fallback,
    ]),
  );
  const hasUnexpectedKeys = Object.keys(current).some(
    (key) => !(key in defaults),
  );
  const hasMissingKeys = Object.keys(defaults).some((key) => !(key in current));

  if (!existsSync(path) || hasUnexpectedKeys || hasMissingKeys) {
    writeFileSync(path, serialize(next, heading), { mode: 0o600 });
    console.log(
      `Updated ${path.replace(`${root}/`, "")} (admin-safe keys only)`,
    );
  } else {
    console.log(`Ready ${path.replace(`${root}/`, "")}`);
  }
  chmodSync(path, 0o600);
}

function initLocal() {
  ensureKeys(
    paths.root,
    {
      POSTGRES_DB: "snapkit",
      POSTGRES_USER: "snapkit",
      POSTGRES_PASSWORD: "snapkit_dev_password",
      GOOGLE_OAUTH_CLIENT_IDS: "",
    },
    "# Local Docker development",
  );
  ensureKeys(
    paths.backend,
    {
      APP_ENV: "development",
      DATABASE_URL:
        "postgresql://snapkit:snapkit_dev_password@localhost:5432/snapkit?schema=public",
      JWT_SECRET: "development-only-secret-change-before-prod-123",
      ADMIN_EMAIL: "admin@snapkit.local",
      ADMIN_PASSWORD: "admin@123",
      COOKIE_SECURE: "false",
      GOOGLE_OAUTH_CLIENT_IDS: "",
    },
    "# Backend local development",
  );
  keepOnlyKeys(
    paths.admin,
    {
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_BACKEND_URL: "http://localhost:3001",
      BACKEND_INTERNAL_URL: "http://localhost:3001",
    },
    "# Admin local development",
  );
}

function productionValues() {
  const password = randomBytes(30).toString("base64url");
  const encodedPassword = encodeURIComponent(password);
  return {
    APP_ENV: "production",
    POSTGRES_DB: "snapkit",
    POSTGRES_USER: "snapkit",
    POSTGRES_PASSWORD: password,
    DATABASE_URL: `postgresql://snapkit:${encodedPassword}@postgres:5432/snapkit?schema=public`,
    JWT_SECRET: randomBytes(48).toString("base64url"),
    ADMIN_EMAIL: "admin@snapkit.local",
    ADMIN_PASSWORD: randomBytes(24).toString("base64url"),
    COOKIE_SECURE: "false",
    GOOGLE_OAUTH_CLIENT_IDS: "",
    STORAGE_SERVER_LABEL: "45.119.214.94",
  };
}

function initProduction() {
  if (existsSync(paths.production) && !force) {
    ensureKeys(
      paths.production,
      { APP_ENV: "production", COOKIE_SECURE: "false", GOOGLE_OAUTH_CLIENT_IDS: "", STORAGE_SERVER_LABEL: "45.119.214.94" },
      "# Production secrets. Keep this file off Git and back it up securely.",
    );
    console.log(
      "Existing production secrets were preserved. Use check-prod to validate them.",
    );
    return;
  }
  writeFileSync(
    paths.production,
    serialize(
      productionValues(),
      "# Generated production secrets. Keep this file off Git and back it up securely.",
    ),
    { mode: 0o600 },
  );
  chmodSync(paths.production, 0o600);
  console.log("Generated .env.prod with random secrets (mode 600).");
  console.log(
    "Review ADMIN_EMAIL and keep ADMIN_PASSWORD in your password manager before deployment.",
  );
  console.log("Set GOOGLE_OAUTH_CLIENT_IDS before running the production check.");
}

function validateProduction() {
  if (!existsSync(paths.production)) {
    throw new Error("Missing .env.prod. Run: pnpm env:init:prod");
  }

  const env = readEnv(paths.production);
  const errors = [];
  const required = [
    "APP_ENV",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
    "JWT_SECRET",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "COOKIE_SECURE",
    "GOOGLE_OAUTH_CLIENT_IDS",
  ];

  for (const key of required) {
    if (!env[key]) errors.push(`${key} is required`);
  }
  if (env.APP_ENV && env.APP_ENV !== "production")
    errors.push("APP_ENV must be production");
  if (env.POSTGRES_PASSWORD && env.POSTGRES_PASSWORD.length < 24)
    errors.push("POSTGRES_PASSWORD must have at least 24 characters");
  if (env.JWT_SECRET && env.JWT_SECRET.length < 32)
    errors.push("JWT_SECRET must have at least 32 characters");
  if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 16)
    errors.push("ADMIN_PASSWORD must have at least 16 characters");
  if (env.ADMIN_EMAIL && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.ADMIN_EMAIL))
    errors.push("ADMIN_EMAIL is invalid");
  if (env.COOKIE_SECURE && !["true", "false"].includes(env.COOKIE_SECURE))
    errors.push("COOKIE_SECURE must be true or false");

  for (const [key, value] of Object.entries(env)) {
    if (
      /REPLACE_|ChangeMe|development-only|snapkit_dev_password/i.test(value)
    ) {
      errors.push(`${key} still contains a development or placeholder value`);
    }
  }

  if (env.DATABASE_URL) {
    try {
      const url = new URL(env.DATABASE_URL);
      if (!["postgresql:", "postgres:"].includes(url.protocol))
        errors.push("DATABASE_URL must use PostgreSQL");
      if (url.hostname !== "postgres")
        errors.push(
          "DATABASE_URL host must be postgres inside production Compose",
        );
    } catch {
      errors.push(
        "DATABASE_URL is not a valid URL; URL-encode special characters in the password",
      );
    }
  }

  if (errors.length) {
    console.error("Production environment is not ready:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("Production environment is valid.");
  if (env.COOKIE_SECURE === "false") {
    console.log(
      "Warning: COOKIE_SECURE=false is only acceptable for the current IP-only HTTP deployment.",
    );
  }
}

switch (command) {
  case "init-local":
    initLocal();
    break;
  case "init-prod":
    initProduction();
    break;
  case "check-prod":
    validateProduction();
    break;
  default:
    console.error(
      "Usage: node scripts/env.mjs <init-local|init-prod|check-prod> [--force]",
    );
    process.exitCode = 1;
}
