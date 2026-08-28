import { describe, expect, it } from "vitest";
import { googleIdentityFromClaims, InvalidGoogleIdTokenError, parseGoogleOAuthClientIds } from "@/lib/google-auth";

describe("Google OAuth configuration", () => {
  it("normalizes and de-duplicates allowed client IDs", () => {
    expect(parseGoogleOAuthClientIds("android-client, web-client,android-client, ")).toEqual([
      "android-client",
      "web-client",
    ]);
  });

  it("returns no audiences when configuration is missing", () => {
    expect(parseGoogleOAuthClientIds(undefined)).toEqual([]);
  });
});

describe("Google ID token claims", () => {
  it("maps a verified Google identity", () => {
    expect(
      googleIdentityFromClaims({
        sub: "google-subject",
        email: " User@Example.com ",
        email_verified: true,
        name: "Snapkit User",
        picture: "https://lh3.googleusercontent.com/avatar",
      }),
    ).toEqual({
      subject: "google-subject",
      email: "user@example.com",
      name: "Snapkit User",
      avatarUrl: "https://lh3.googleusercontent.com/avatar",
    });
  });

  it("rejects an unverified email or missing subject", () => {
    expect(() => googleIdentityFromClaims({ sub: "subject", email: "user@example.com", email_verified: false })).toThrow(
      InvalidGoogleIdTokenError,
    );
    expect(() => googleIdentityFromClaims({ email: "user@example.com", email_verified: true })).toThrow(
      InvalidGoogleIdTokenError,
    );
  });

  it("drops non-HTTPS avatar URLs", () => {
    expect(
      googleIdentityFromClaims({
        sub: "subject",
        email: "user@example.com",
        email_verified: true,
        picture: "http://example.com/avatar",
      }).avatarUrl,
    ).toBeNull();
  });
});
