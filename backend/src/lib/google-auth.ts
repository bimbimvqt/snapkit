import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const googleIssuers = ["https://accounts.google.com", "accounts.google.com"];

export class GoogleAuthConfigurationError extends Error {
  constructor() {
    super("GOOGLE_OAUTH_CLIENT_IDS is not configured");
    this.name = "GoogleAuthConfigurationError";
  }
}

export class InvalidGoogleIdTokenError extends Error {
  constructor() {
    super("Google ID token is invalid");
    this.name = "InvalidGoogleIdTokenError";
  }
}

export type GoogleIdentity = {
  subject: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export function parseGoogleOAuthClientIds(value: string | undefined) {
  return [...new Set((value ?? "").split(",").map((clientId) => clientId.trim()).filter(Boolean))];
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function googleIdentityFromClaims(payload: JWTPayload): GoogleIdentity {
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!payload.sub || !email || payload.email_verified !== true) throw new InvalidGoogleIdTokenError();

  const rawName = typeof payload.name === "string" ? payload.name.trim() : "";
  return {
    subject: payload.sub,
    email,
    name: rawName || null,
    avatarUrl: httpsUrl(payload.picture),
  };
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const audiences = parseGoogleOAuthClientIds(process.env.GOOGLE_OAUTH_CLIENT_IDS);
  if (!audiences.length) throw new GoogleAuthConfigurationError();

  try {
    const { payload } = await jwtVerify(idToken, googleJwks, {
      algorithms: ["RS256"],
      audience: audiences,
      issuer: googleIssuers,
    });
    return googleIdentityFromClaims(payload);
  } catch (error) {
    if (error instanceof InvalidGoogleIdTokenError) throw error;
    throw new InvalidGoogleIdTokenError();
  }
}
