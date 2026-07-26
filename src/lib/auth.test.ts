/** @jest-environment node */

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

type MockPrisma = { user: { findUnique: jest.Mock; update: jest.Mock } };

const ENV_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
  "BETA_ONLY_MODE",
  "BETA_ALLOWLIST_EMAILS",
] as const;

function snapshotEnv() {
  const snapshot: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) snapshot[key] = process.env[key];
  return snapshot;
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

// Both provider registration (module-load-time) and BETA_ONLY_MODE/allowlist
// (evaluated once when src/lib/betaAccess.ts loads) depend on env vars read
// at import time, so a fresh module instance is required per scenario.
// jest.resetModules() also creates a brand-new instance of the mocked
// @/lib/prisma module (a fresh set of jest.fn()s from the factory above), so
// the mock reference must be re-resolved *after* every reset — a mock
// configured against a stale reference silently has zero effect on the
// freshly re-imported auth.ts.
async function importAuthWithEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  const previous = snapshotEnv();
  for (const key of ENV_KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  jest.resetModules();
  const mod = await import("./auth");
  const prismaMod = await import("@/lib/prisma");
  restoreEnv(previous);
  const mockPrisma = prismaMod.default as unknown as MockPrisma;
  mockPrisma.user.findUnique.mockReset();
  mockPrisma.user.update.mockReset();
  return { ...mod, mockPrisma };
}

function makeGoogleProfile(overrides: Partial<{ sub: string; email: string; email_verified: boolean; picture: string; name: string }> = {}) {
  return {
    sub: "google-subject-123",
    email: "person@example.test",
    email_verified: true,
    name: "Google Display Name",
    picture: "https://example.test/avatar.png",
    aud: "aud", azp: "azp", exp: 0, family_name: "F", given_name: "G", hd: "", iat: 0, iss: "iss", jti: "jti", nbf: 0,
    ...overrides,
  };
}

function makeFacebookProfile(
  overrides: Partial<{ id: string; email: string; name: string; picture: string | null }> = {}
) {
  const { picture, ...rest } = overrides;
  const pictureUrl = picture === undefined ? "https://example.test/fb-avatar.png" : picture;
  return {
    id: "facebook-account-123",
    email: "person@example.test",
    name: "Facebook Display Name",
    picture: pictureUrl === null ? undefined : { data: { url: pictureUrl } },
    ...rest,
  };
}

describe("hasGoogleOAuthConfiguration", () => {
  it("1. both variables present enables Google", async () => {
    const { hasGoogleOAuthConfiguration } = await import("./auth");
    expect(hasGoogleOAuthConfiguration({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it("2. missing client ID disables Google", async () => {
    const { hasGoogleOAuthConfiguration } = await import("./auth");
    expect(hasGoogleOAuthConfiguration({ GOOGLE_CLIENT_SECRET: "secret" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("3. missing secret disables Google", async () => {
    const { hasGoogleOAuthConfiguration } = await import("./auth");
    expect(hasGoogleOAuthConfiguration({ GOOGLE_CLIENT_ID: "id" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("4. blank client ID disables Google", async () => {
    const { hasGoogleOAuthConfiguration } = await import("./auth");
    expect(hasGoogleOAuthConfiguration({ GOOGLE_CLIENT_ID: "   ", GOOGLE_CLIENT_SECRET: "secret" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("5. blank secret disables Google", async () => {
    const { hasGoogleOAuthConfiguration } = await import("./auth");
    expect(hasGoogleOAuthConfiguration({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "   " } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("hasFacebookOAuthConfiguration", () => {
  it("1. both variables present enables Facebook", async () => {
    const { hasFacebookOAuthConfiguration } = await import("./auth");
    expect(hasFacebookOAuthConfiguration({ FACEBOOK_CLIENT_ID: "id", FACEBOOK_CLIENT_SECRET: "secret" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it("2. missing client ID disables Facebook", async () => {
    const { hasFacebookOAuthConfiguration } = await import("./auth");
    expect(hasFacebookOAuthConfiguration({ FACEBOOK_CLIENT_SECRET: "secret" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("3. missing secret disables Facebook", async () => {
    const { hasFacebookOAuthConfiguration } = await import("./auth");
    expect(hasFacebookOAuthConfiguration({ FACEBOOK_CLIENT_ID: "id" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("4. blank client ID disables Facebook", async () => {
    const { hasFacebookOAuthConfiguration } = await import("./auth");
    expect(hasFacebookOAuthConfiguration({ FACEBOOK_CLIENT_ID: "   ", FACEBOOK_CLIENT_SECRET: "secret" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("5. blank secret disables Facebook", async () => {
    const { hasFacebookOAuthConfiguration } = await import("./auth");
    expect(hasFacebookOAuthConfiguration({ FACEBOOK_CLIENT_ID: "id", FACEBOOK_CLIENT_SECRET: "   " } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("provider registration", () => {
  it("6. Credentials remains enabled without Google", async () => {
    const { authOptions } = await importAuthWithEnv({});
    const ids = authOptions.providers.map((p) => p.id);
    expect(ids).toEqual(["credentials"]);
  });

  it("7. complete configuration includes Google once, Credentials first and unchanged", async () => {
    const { authOptions } = await importAuthWithEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
    const ids = authOptions.providers.map((p) => p.id);
    expect(ids[0]).toBe("credentials");
    expect(ids.filter((id) => id === "google")).toHaveLength(1);
  });

  it("8. Facebook registers exactly once", async () => {
    const { authOptions } = await importAuthWithEnv({ FACEBOOK_CLIENT_ID: "id", FACEBOOK_CLIENT_SECRET: "secret" });
    const ids = authOptions.providers.map((p) => p.id);
    expect(ids.filter((id) => id === "facebook")).toHaveLength(1);
  });

  it("9. both providers configured produce the exact order credentials, google, facebook", async () => {
    const { authOptions } = await importAuthWithEnv({
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      FACEBOOK_CLIENT_ID: "id",
      FACEBOOK_CLIENT_SECRET: "secret",
    });
    const ids = authOptions.providers.map((p) => p.id);
    expect(ids).toEqual(["credentials", "google", "facebook"]);
  });

  it("10. Google-only configuration remains credentials, google", async () => {
    const { authOptions } = await importAuthWithEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
    const ids = authOptions.providers.map((p) => p.id);
    expect(ids).toEqual(["credentials", "google"]);
  });

  it("11. Facebook-only configuration remains credentials, facebook", async () => {
    const { authOptions } = await importAuthWithEnv({ FACEBOOK_CLIENT_ID: "id", FACEBOOK_CLIENT_SECRET: "secret" });
    const ids = authOptions.providers.map((p) => p.id);
    expect(ids).toEqual(["credentials", "facebook"]);
  });
});

describe("mapGoogleProfile", () => {
  it("8. valid profile maps subject to provider ID", async () => {
    const { mapGoogleProfile } = await import("./auth");
    const result = mapGoogleProfile(makeGoogleProfile({ sub: "abc123" }) as never);
    expect(result.id).toBe("abc123");
  });

  it("9. email is normalized", async () => {
    const { mapGoogleProfile } = await import("./auth");
    const result = mapGoogleProfile(makeGoogleProfile({ email: "  Person@Example.TEST  " }) as never);
    expect(result.email).toBe("person@example.test");
  });

  it("10. Google display name is not assigned to User.name", async () => {
    const { mapGoogleProfile } = await import("./auth");
    const result = mapGoogleProfile(makeGoogleProfile({ name: "Jane Doe" }) as never);
    expect(result.name).toBeNull();
  });

  it("11. picture is preserved", async () => {
    const { mapGoogleProfile } = await import("./auth");
    const result = mapGoogleProfile(makeGoogleProfile({ picture: "https://example.test/x.png" }) as never);
    expect(result.image).toBe("https://example.test/x.png");
  });

  it("12. missing picture becomes null", async () => {
    const { mapGoogleProfile } = await import("./auth");
    const result = mapGoogleProfile(makeGoogleProfile({ picture: "" }) as never);
    expect(result.image).toBeNull();
  });

  it("13. verified email creates emailVerified", async () => {
    const { mapGoogleProfile } = await import("./auth");
    const result = mapGoogleProfile(makeGoogleProfile({ email_verified: true }) as never);
    expect(result.emailVerified).toBeInstanceOf(Date);
  });

  it("14. unverified email does not create a verified date", async () => {
    const { mapGoogleProfile } = await import("./auth");
    const result = mapGoogleProfile(makeGoogleProfile({ email_verified: false }) as never);
    expect(result.emailVerified).toBeNull();
  });

  it("15. missing subject is rejected", async () => {
    const { mapGoogleProfile } = await import("./auth");
    expect(() => mapGoogleProfile(makeGoogleProfile({ sub: "" }) as never)).toThrow();
  });

  it("16. missing email is safely mapped to an empty string (rejected later by the signIn callback)", async () => {
    const { mapGoogleProfile } = await import("./auth");
    const result = mapGoogleProfile(makeGoogleProfile({ email: "" }) as never);
    expect(result.email).toBe("");
  });

  it("17. mapping does not mutate the source profile", async () => {
    const { mapGoogleProfile } = await import("./auth");
    const profile = makeGoogleProfile();
    const snapshot = { ...profile };
    mapGoogleProfile(profile as never);
    expect(profile).toEqual(snapshot);
  });

  it.each([
    ["non-string", 123],
    ["blank", "   "],
    ["invalid", "not a url"],
    ["relative", "/avatar.png"],
    ["javascript", "javascript:alert(1)"],
    ["data", "data:image/png;base64,AA=="],
    ["http", "http://example.test/avatar.png"],
  ])("rejects a %s profile image", async (_label, value) => {
    const { normalizeGoogleProfileImage } = await import("./auth");
    expect(normalizeGoogleProfileImage(value)).toBeNull();
  });

  it("trims and preserves a valid HTTPS profile image URL", async () => {
    const { normalizeGoogleProfileImage } = await import("./auth");
    expect(normalizeGoogleProfileImage("  https://example.test/avatar.png?size=96  ")).toBe(
      "https://example.test/avatar.png?size=96"
    );
  });
});

describe("mapFacebookProfile", () => {
  it("1. stable Facebook ID is used as the provider account ID", async () => {
    const { mapFacebookProfile } = await import("./auth");
    const result = mapFacebookProfile(makeFacebookProfile({ id: "fb-abc123" }) as never);
    expect(result.id).toBe("fb-abc123");
  });

  it("2. missing ID throws the safe contained error", async () => {
    const { mapFacebookProfile } = await import("./auth");
    expect(() => mapFacebookProfile(makeFacebookProfile({ id: "" }) as never)).toThrow(
      "Facebook profile is missing an account identifier."
    );
  });

  it("2b. blank ID throws the safe contained error", async () => {
    const { mapFacebookProfile } = await import("./auth");
    expect(() => mapFacebookProfile(makeFacebookProfile({ id: "   " }) as never)).toThrow(
      "Facebook profile is missing an account identifier."
    );
  });

  it("3. email is trimmed and lowercased", async () => {
    const { mapFacebookProfile } = await import("./auth");
    const result = mapFacebookProfile(makeFacebookProfile({ email: "  Person@Example.TEST  " }) as never);
    expect(result.email).toBe("person@example.test");
  });

  it("4. missing email maps to an empty string (rejected later by the signIn callback)", async () => {
    const { mapFacebookProfile } = await import("./auth");
    const result = mapFacebookProfile(makeFacebookProfile({ email: "" }) as never);
    expect(result.email).toBe("");
  });

  it("5. Facebook display name is never assigned to User.name", async () => {
    const { mapFacebookProfile } = await import("./auth");
    const result = mapFacebookProfile(makeFacebookProfile({ name: "Jane Doe" }) as never);
    expect(result.name).toBeNull();
  });

  it("6. valid nested HTTPS picture is retained", async () => {
    const { mapFacebookProfile } = await import("./auth");
    const result = mapFacebookProfile(makeFacebookProfile({ picture: "https://example.test/fb.png" }) as never);
    expect(result.image).toBe("https://example.test/fb.png");
  });

  it("7. missing picture becomes null", async () => {
    const { mapFacebookProfile } = await import("./auth");
    const result = mapFacebookProfile(makeFacebookProfile({ picture: null }) as never);
    expect(result.image).toBeNull();
  });

  it.each([
    ["non-string", 123],
    ["blank", "   "],
    ["invalid", "not a url"],
    ["relative", "/avatar.png"],
    ["javascript", "javascript:alert(1)"],
    ["data", "data:image/png;base64,AA=="],
    ["http", "http://example.test/avatar.png"],
  ])("8. rejects a %s nested Facebook picture URL", async (_label, value) => {
    const { normalizeFacebookProfileImage } = await import("./auth");
    const profile = makeFacebookProfile({ picture: value as unknown as string });
    expect(normalizeFacebookProfileImage(profile as never)).toBeNull();
  });

  it("9. mapping does not mutate the source profile", async () => {
    const { mapFacebookProfile } = await import("./auth");
    const profile = makeFacebookProfile();
    const snapshot = JSON.parse(JSON.stringify(profile));
    mapFacebookProfile(profile as never);
    expect(profile).toEqual(snapshot);
  });

  it("10. emailVerified is never falsely populated", async () => {
    const { mapFacebookProfile } = await import("./auth");
    const result = mapFacebookProfile(makeFacebookProfile() as never);
    expect(result.emailVerified).toBeNull();
  });
});

describe("signIn callback — beta access", () => {
  function callSignIn(mod: Awaited<ReturnType<typeof importAuthWithEnv>>, args: { user: unknown; account: unknown; profile?: unknown }) {
    const signIn = mod.authOptions.callbacks!.signIn!;
    return signIn(args as never);
  }

  it("18. outside beta mode, a verified Google email is accepted", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "false" });
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "google" },
      profile: makeGoogleProfile({ email_verified: true }),
    });
    expect(result).toBe(true);
  });

  it("19. missing Google email is denied", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "false" });
    const result = await callSignIn(mod, {
      user: { email: undefined },
      account: { provider: "google" },
      profile: makeGoogleProfile({ email_verified: true }),
    });
    expect(result).toBe(false);
  });

  it("20. blank Google email is denied", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "false" });
    const result = await callSignIn(mod, {
      user: { email: "   " },
      account: { provider: "google" },
      profile: makeGoogleProfile({ email_verified: true }),
    });
    expect(result).toBe(false);
  });

  it("21. unverified Google email is denied", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "false" });
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "google" },
      profile: makeGoogleProfile({ email_verified: false }),
    });
    expect(result).toBe(false);
  });

  it("22. allowlisted first-time Google user is accepted during beta", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true", BETA_ALLOWLIST_EMAILS: "person@example.test" });
    mod.mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "google" },
      profile: makeGoogleProfile({ email_verified: true }),
    });
    expect(result).toBe(true);
  });

  it("23. nonallowlisted first-time Google user is denied during beta", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true", BETA_ALLOWLIST_EMAILS: "someone-else@example.test" });
    mod.mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "google" },
      profile: makeGoogleProfile({ email_verified: true }),
    });
    expect(result).toBe(false);
  });

  it("24. existing beta-approved user is accepted", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true" });
    mod.mockPrisma.user.findUnique.mockResolvedValue({ role: "user", betaApproved: true });
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "google" },
      profile: makeGoogleProfile({ email_verified: true }),
    });
    expect(result).toBe(true);
  });

  it("25. existing admin is accepted", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true" });
    mod.mockPrisma.user.findUnique.mockResolvedValue({ role: "admin", betaApproved: false });
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "google" },
      profile: makeGoogleProfile({ email_verified: true }),
    });
    expect(result).toBe(true);
  });

  it("26. existing allowlisted user is persisted as beta-approved", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true", BETA_ALLOWLIST_EMAILS: "person@example.test" });
    mod.mockPrisma.user.findUnique.mockResolvedValue({ role: "user", betaApproved: false });
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "google" },
      profile: makeGoogleProfile({ email_verified: true }),
    });
    expect(result).toBe(true);
    expect(mod.mockPrisma.user.update).toHaveBeenCalledWith({
      where: { email: "person@example.test" },
      data: { betaApproved: true },
    });
  });

  it("27. existing unapproved nonallowlisted user is denied", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true", BETA_ALLOWLIST_EMAILS: "someone-else@example.test" });
    mod.mockPrisma.user.findUnique.mockResolvedValue({ role: "user", betaApproved: false });
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "google" },
      profile: makeGoogleProfile({ email_verified: true }),
    });
    expect(result).toBe(false);
  });

  it("28. Credentials provider behavior is not denied by the Google-only branch", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true" });
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "credentials" },
    });
    expect(result).toBe(true);
    expect(mod.mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("F1. Facebook with a nonblank email is accepted outside beta mode", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "false" });
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "facebook" },
      profile: makeFacebookProfile(),
    });
    expect(result).toBe(true);
  });

  it("F2. Facebook missing email is denied", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "false" });
    const result = await callSignIn(mod, {
      user: { email: undefined },
      account: { provider: "facebook" },
      profile: makeFacebookProfile({ email: "" }),
    });
    expect(result).toBe(false);
  });

  it("F2b. Facebook blank email is denied", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "false" });
    const result = await callSignIn(mod, {
      user: { email: "   " },
      account: { provider: "facebook" },
      profile: makeFacebookProfile({ email: "   " }),
    });
    expect(result).toBe(false);
  });

  it("F3. new allowlisted Facebook user is accepted during beta", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true", BETA_ALLOWLIST_EMAILS: "person@example.test" });
    mod.mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "facebook" },
      profile: makeFacebookProfile(),
    });
    expect(result).toBe(true);
  });

  it("F4. new nonallowlisted Facebook user is denied during beta", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true", BETA_ALLOWLIST_EMAILS: "someone-else@example.test" });
    mod.mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "facebook" },
      profile: makeFacebookProfile(),
    });
    expect(result).toBe(false);
  });

  it("F5. existing beta-approved Facebook user is accepted", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true" });
    mod.mockPrisma.user.findUnique.mockResolvedValue({ role: "user", betaApproved: true });
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "facebook" },
      profile: makeFacebookProfile(),
    });
    expect(result).toBe(true);
  });

  it("F6. existing allowlisted Facebook user may have betaApproved persisted", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true", BETA_ALLOWLIST_EMAILS: "person@example.test" });
    mod.mockPrisma.user.findUnique.mockResolvedValue({ role: "user", betaApproved: false });
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "facebook" },
      profile: makeFacebookProfile(),
    });
    expect(result).toBe(true);
    expect(mod.mockPrisma.user.update).toHaveBeenCalledWith({
      where: { email: "person@example.test" },
      data: { betaApproved: true },
    });
  });

  it("F7. Prisma lookup failure denies Facebook safely and does not leak details", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true" });
    const failure = new Error("connection refused at db.internal:5432 user=admin");
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mod.mockPrisma.user.findUnique.mockRejectedValue(failure);

    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "facebook" },
      profile: makeFacebookProfile(),
    });

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith("Failed to look up existing user during OAuth sign-in:", failure);
    consoleSpy.mockRestore();
  });

  it("F8. shared OAuth logs contain no token, secret, or code values", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "true" });
    const failure = new Error("database unavailable");
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mod.mockPrisma.user.findUnique.mockRejectedValue(failure);

    await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "facebook", access_token: "secret-access-token", refresh_token: "secret-refresh-token" },
      profile: makeFacebookProfile(),
    });

    for (const call of consoleSpy.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain("secret-access-token");
      expect(serialized).not.toContain("secret-refresh-token");
    }
    consoleSpy.mockRestore();
  });

  it("F9. Facebook does not require Google's email_verified signal", async () => {
    const mod = await importAuthWithEnv({ BETA_ONLY_MODE: "false" });
    // Facebook profiles never carry an email_verified field at all; a
    // nonblank email alone must be sufficient.
    const result = await callSignIn(mod, {
      user: { email: "person@example.test" },
      account: { provider: "facebook" },
      profile: { id: "fb-1", email: "person@example.test", name: "Someone" },
    });
    expect(result).toBe(true);
  });

  it("F10. no automatic account-linking option is enabled for Facebook sign-in", async () => {
    const SOURCE = require("fs").readFileSync(require("path").join(__dirname, "auth.ts"), "utf8") as string;
    expect(SOURCE).not.toMatch(/allowDangerousEmailAccountLinking/);
  });
});

describe("createUser event — new-user beta persistence", () => {
  function callCreateUser(mod: Awaited<ReturnType<typeof importAuthWithEnv>>, user: unknown) {
    return mod.authOptions.events!.createUser!({ user } as never);
  }

  it("normalizes an allowlisted email and updates only betaApproved using the new user ID", async () => {
    const mod = await importAuthWithEnv({
      BETA_ONLY_MODE: "true",
      BETA_ALLOWLIST_EMAILS: "person@example.test",
    });

    await callCreateUser(mod, {
      id: "new-google-user",
      email: "  Person@Example.TEST  ",
      role: "admin",
      name: "Do not write",
      password: "do-not-write",
    });

    expect(mod.mockPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(mod.mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "new-google-user" },
      data: { betaApproved: true },
    });
  });

  it.each([
    ["nonallowlisted", { id: "u1", email: "other@example.test" }],
    ["missing", { id: "u2" }],
    ["blank", { id: "u3", email: "   " }],
  ])("performs no update for a %s email", async (_label, user) => {
    const mod = await importAuthWithEnv({
      BETA_ONLY_MODE: "true",
      BETA_ALLOWLIST_EMAILS: "person@example.test",
    });
    await callCreateUser(mod, user);
    expect(mod.mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("contains and reports a Prisma failure without throwing", async () => {
    const mod = await importAuthWithEnv({
      BETA_ONLY_MODE: "true",
      BETA_ALLOWLIST_EMAILS: "person@example.test",
    });
    const failure = new Error("database unavailable");
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mod.mockPrisma.user.update.mockRejectedValue(failure);

    await expect(
      callCreateUser(mod, { id: "new-google-user", email: "person@example.test" })
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to persist beta approval for new OAuth user:",
      failure
    );
    consoleSpy.mockRestore();
  });

  it("normalizes an allowlisted email and persists betaApproved for a new Facebook user", async () => {
    const mod = await importAuthWithEnv({
      BETA_ONLY_MODE: "true",
      BETA_ALLOWLIST_EMAILS: "person@example.test",
    });

    await callCreateUser(mod, {
      id: "new-facebook-user",
      email: "  Person@Example.TEST  ",
      name: null,
    });

    expect(mod.mockPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(mod.mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "new-facebook-user" },
      data: { betaApproved: true },
    });
  });
});

describe("jwt callback — database hydration", () => {
  function callJwt(mod: Awaited<ReturnType<typeof importAuthWithEnv>>, args: { token: Record<string, unknown>; user?: unknown }) {
    const jwtCb = mod.authOptions.callbacks!.jwt!;
    return jwtCb(args as never);
  }

  it("29-31. user ID, role, and beta status are loaded from Prisma", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({ id: "db-user-1", role: "moderator", betaApproved: true });
    const token = await callJwt(mod, { token: {}, user: { id: "db-user-1" } });
    expect(token.id).toBe("db-user-1");
    expect(token.role).toBe("moderator");
    expect(token.betaApproved).toBe(true);
  });

  it("32. admin role is preserved", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({ id: "db-user-1", role: "admin", betaApproved: false });
    const token = await callJwt(mod, { token: {}, user: { id: "db-user-1" } });
    expect(token.role).toBe("admin");
  });

  it("33. email lookup is normalized", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({ id: "db-user-2", role: "user", betaApproved: false });
    await callJwt(mod, { token: { email: "  Person@Example.TEST  " }, user: {} });
    expect(mod.mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "person@example.test" },
      select: { id: true, name: true, role: true, betaApproved: true },
    });
  });

  it("34. missing DB record uses safe defaults", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue(null);
    const token = await callJwt(mod, { token: {}, user: { id: "ghost-id" } });
    expect(token.role).toBe("user");
    expect(token.betaApproved).toBe(false);
  });

  it("35. blank email causes no Prisma email lookup", async () => {
    const mod = await importAuthWithEnv({});
    await callJwt(mod, { token: { email: "   " }, user: {} });
    expect(mod.mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("36. Google access tokens are never copied into the token", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({ id: "db-user-1", role: "user", betaApproved: false });
    const token = await callJwt(mod, { token: {}, user: { id: "db-user-1" } });
    expect(token).not.toHaveProperty("accessToken");
    expect(token).not.toHaveProperty("refreshToken");
    expect(token).not.toHaveProperty("id_token");
  });

  it("36b. Facebook access tokens are never copied into the token, and display name stays null", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({ id: "db-facebook-user", name: null, role: "user", betaApproved: false });
    const token = await callJwt(mod, {
      token: {},
      user: { id: "db-facebook-user", accessToken: "fb-secret-token" } as never,
    });
    expect(token).not.toHaveProperty("accessToken");
    expect(token).not.toHaveProperty("refreshToken");
    expect(token).not.toHaveProperty("id_token");
    expect(token.name).toBeNull();
  });

  it("37. session callback exposes only existing PuzzleWarz fields", async () => {
    const mod = await importAuthWithEnv({});
    const sessionCb = mod.authOptions.callbacks!.session!;
    const session = await sessionCb({
      session: { user: {} },
      token: { id: "u1", role: "admin", betaApproved: true },
    } as never);
    expect((session.user as { id?: string; role?: string; betaApproved?: boolean }).id).toBe("u1");
    expect((session.user as { role?: string }).role).toBe("admin");
    expect((session.user as { betaApproved?: boolean }).betaApproved).toBe(true);
    expect(session).not.toHaveProperty("accessToken");
  });

  it("does not throw when no user record can be resolved at all", async () => {
    const mod = await importAuthWithEnv({});
    await expect(callJwt(mod, { token: {}, user: { id: undefined } })).resolves.toBeDefined();
  });
});

describe("jwt callback — session update trigger", () => {
  function callJwt(
    mod: Awaited<ReturnType<typeof importAuthWithEnv>>,
    args: { token: Record<string, unknown>; trigger?: string; session?: unknown }
  ) {
    const jwtCb = mod.authOptions.callbacks!.jwt!;
    return jwtCb(args as never);
  }

  it("40. reloads the user by token ID first when an ID is present", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({
      id: "db-user-9",
      name: "ExistingName",
      role: "user",
      betaApproved: false,
    });
    await callJwt(mod, { token: { id: "db-user-9", email: "person@example.test" }, trigger: "update" });
    expect(mod.mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "db-user-9" },
      select: { id: true, name: true, role: true, betaApproved: true },
    });
  });

  it("41. normalized email fallback is only used when no token ID exists", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({
      id: "db-user-9",
      name: "ExistingName",
      role: "user",
      betaApproved: false,
    });
    await callJwt(mod, { token: { email: "  Person@Example.TEST  " }, trigger: "update" });
    expect(mod.mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "person@example.test" },
      select: { id: true, name: true, role: true, betaApproved: true },
    });
  });

  it("42. the trusted database name replaces a null token name", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "ChosenName",
      role: "user",
      betaApproved: false,
    });
    const token = await callJwt(mod, { token: { id: "u1", name: null }, trigger: "update" });
    expect(token.name).toBe("ChosenName");
  });

  it("43. a blank database name becomes null", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "   ", role: "user", betaApproved: false });
    const token = await callJwt(mod, { token: { id: "u1", name: "leftover" }, trigger: "update" });
    expect(token.name).toBeNull();
  });

  it("44. client-provided session update data cannot inject a name", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: null, role: "user", betaApproved: false });
    const token = await callJwt(mod, {
      token: { id: "u1", name: null },
      trigger: "update",
      session: { user: { name: "InjectedName" } },
    });
    expect(token.name).toBeNull();
    expect(token.name).not.toBe("InjectedName");
  });

  it("45. existing role and beta status hydration remains correct on update", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "Name", role: "admin", betaApproved: true });
    const token = await callJwt(mod, { token: { id: "u1" }, trigger: "update" });
    expect(token.role).toBe("admin");
    expect(token.betaApproved).toBe(true);
  });

  it("46. a Prisma failure during update is contained and preserves the existing token", async () => {
    const mod = await importAuthWithEnv({});
    const failure = new Error("database unavailable");
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mod.mockPrisma.user.findUnique.mockRejectedValue(failure);

    const token = await callJwt(mod, {
      token: { id: "u1", name: "PreservedName", role: "user", betaApproved: false },
      trigger: "update",
    });

    expect(token.name).toBe("PreservedName");
    expect(token.role).toBe("user");
    expect(token.betaApproved).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("47. session callback exposes the trusted JWT name", async () => {
    const mod = await importAuthWithEnv({});
    const sessionCb = mod.authOptions.callbacks!.session!;
    const session = await sessionCb({
      session: { user: {} },
      token: { id: "u1", name: "TrustedName", role: "user", betaApproved: false },
    } as never);
    expect((session.user as { name?: string | null }).name).toBe("TrustedName");
  });

  it("48. session callback exposes null when the JWT name is blank", async () => {
    const mod = await importAuthWithEnv({});
    const sessionCb = mod.authOptions.callbacks!.session!;
    const session = await sessionCb({
      session: { user: {} },
      token: { id: "u1", name: "   ", role: "user", betaApproved: false },
    } as never);
    expect((session.user as { name?: string | null }).name).toBeNull();
  });

  it("49. Google tokens remain absent after an update-trigger refresh", async () => {
    const mod = await importAuthWithEnv({});
    mod.mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "Name", role: "user", betaApproved: false });
    const token = await callJwt(mod, { token: { id: "u1" }, trigger: "update" });
    expect(token).not.toHaveProperty("accessToken");
    expect(token).not.toHaveProperty("refreshToken");
    expect(token).not.toHaveProperty("id_token");
  });
});

describe("account-linking guardrail", () => {
  const SOURCE = require("fs").readFileSync(require("path").join(__dirname, "auth.ts"), "utf8") as string;

  it("38. source does not contain allowDangerousEmailAccountLinking", () => {
    expect(SOURCE).not.toMatch(/allowDangerousEmailAccountLinking/);
  });

  it("39. source does not enable automatic email linking", () => {
    expect(SOURCE).not.toMatch(/allowDangerousEmailAccountLinking\s*:\s*true/);
  });
});

describe("Google initiation helpers", () => {
  it.each([
    ["sign-in", async () => (await import("../app/auth/signin/page")).initiateGoogleSignIn],
    ["registration", async () => (await import("../app/auth/register/page")).initiateGoogleSignUp],
  ] as const)(
    "%s keeps pending state and the guard after a resolved initiation",
    async (_label, loadInitiate) => {
      const initiate = (await loadInitiate()) as (options: {
        mountedRef: { current: boolean };
        inFlightRef: { current: boolean };
        setConnecting: (value: boolean) => void;
        setError: (value: string) => void;
        start: () => Promise<unknown>;
      }) => Promise<void>;
      const mountedRef = { current: true };
      const inFlightRef = { current: false };
      const setConnecting = jest.fn();
      const setError = jest.fn();
      const start = jest.fn().mockResolvedValue(undefined);
      const options = { mountedRef, inFlightRef, setConnecting, setError, start };

      await initiate(options);
      expect(start).toHaveBeenCalledTimes(1);
      expect(inFlightRef.current).toBe(true);
      expect(setConnecting).toHaveBeenLastCalledWith(true);

      await initiate(options);
      expect(start).toHaveBeenCalledTimes(1);
      expect(setConnecting).not.toHaveBeenCalledWith(false);
    }
  );

  it.each([
    ["sign-in", async () => (await import("../app/auth/signin/page")).initiateGoogleSignIn],
    ["registration", async () => (await import("../app/auth/register/page")).initiateGoogleSignUp],
  ] as const)(
    "%s retained invocation after unmount is a no-op",
    async (_label, loadInitiate) => {
      const initiate = (await loadInitiate()) as (options: {
        mountedRef: { current: boolean };
        inFlightRef: { current: boolean };
        setConnecting: (value: boolean) => void;
        setError: (value: string) => void;
        start: () => Promise<unknown>;
      }) => Promise<void>;
      const setConnecting = jest.fn();
      const setError = jest.fn();
      const start = jest.fn().mockResolvedValue(undefined);

      await expect(
        initiate({
          mountedRef: { current: false },
          inFlightRef: { current: false },
          setConnecting,
          setError,
          start,
        })
      ).resolves.toBeUndefined();
      expect(start).not.toHaveBeenCalled();
      expect(setConnecting).not.toHaveBeenCalled();
      expect(setError).not.toHaveBeenCalled();
    }
  );
});

describe("Facebook initiation helpers", () => {
  it.each([
    ["sign-in", async () => (await import("../app/auth/signin/page")).initiateFacebookSignIn],
    ["registration", async () => (await import("../app/auth/register/page")).initiateFacebookSignUp],
  ] as const)(
    "%s keeps pending state and the guard after a resolved initiation",
    async (_label, loadInitiate) => {
      const initiate = (await loadInitiate()) as (options: {
        mountedRef: { current: boolean };
        inFlightRef: { current: boolean };
        setConnecting: (value: boolean) => void;
        setError: (value: string) => void;
        start: () => Promise<unknown>;
      }) => Promise<void>;
      const mountedRef = { current: true };
      const inFlightRef = { current: false };
      const setConnecting = jest.fn();
      const setError = jest.fn();
      const start = jest.fn().mockResolvedValue(undefined);
      const options = { mountedRef, inFlightRef, setConnecting, setError, start };

      await initiate(options);
      expect(start).toHaveBeenCalledTimes(1);
      expect(inFlightRef.current).toBe(true);
      expect(setConnecting).toHaveBeenLastCalledWith(true);

      await initiate(options);
      expect(start).toHaveBeenCalledTimes(1);
      expect(setConnecting).not.toHaveBeenCalledWith(false);
    }
  );

  it.each([
    ["sign-in", async () => (await import("../app/auth/signin/page")).initiateFacebookSignIn],
    ["registration", async () => (await import("../app/auth/register/page")).initiateFacebookSignUp],
  ] as const)(
    "%s retained invocation after unmount is a no-op",
    async (_label, loadInitiate) => {
      const initiate = (await loadInitiate()) as (options: {
        mountedRef: { current: boolean };
        inFlightRef: { current: boolean };
        setConnecting: (value: boolean) => void;
        setError: (value: string) => void;
        start: () => Promise<unknown>;
      }) => Promise<void>;
      const setConnecting = jest.fn();
      const setError = jest.fn();
      const start = jest.fn().mockResolvedValue(undefined);

      await expect(
        initiate({
          mountedRef: { current: false },
          inFlightRef: { current: false },
          setConnecting,
          setError,
          start,
        })
      ).resolves.toBeUndefined();
      expect(start).not.toHaveBeenCalled();
      expect(setConnecting).not.toHaveBeenCalled();
      expect(setError).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["sign-in", async () => {
      const mod = await import("../app/auth/signin/page");
      return { initiateGoogle: mod.initiateGoogleSignIn, initiateFacebook: mod.initiateFacebookSignIn };
    }],
    ["registration", async () => {
      const mod = await import("../app/auth/register/page");
      return { initiateGoogle: mod.initiateGoogleSignUp, initiateFacebook: mod.initiateFacebookSignUp };
    }],
  ] as const)(
    "%s a shared in-flight ref lets Google block a concurrent Facebook initiation and vice versa",
    async (_label, loadInitiators) => {
      const { initiateGoogle, initiateFacebook } = await loadInitiators();
      const mountedRef = { current: true };
      const sharedInFlightRef = { current: false };
      const googleConnecting = jest.fn();
      const facebookConnecting = jest.fn();
      const setError = jest.fn();
      const googleStart = jest.fn().mockResolvedValue(undefined);
      const facebookStart = jest.fn().mockResolvedValue(undefined);

      await initiateGoogle({
        mountedRef,
        inFlightRef: sharedInFlightRef,
        setConnecting: googleConnecting,
        setError,
        start: googleStart,
      });
      expect(googleStart).toHaveBeenCalledTimes(1);

      // The shared ref is already claimed by Google — Facebook's initiation
      // must be ignored entirely.
      await initiateFacebook({
        mountedRef,
        inFlightRef: sharedInFlightRef,
        setConnecting: facebookConnecting,
        setError,
        start: facebookStart,
      });
      expect(facebookStart).not.toHaveBeenCalled();
      expect(facebookConnecting).not.toHaveBeenCalled();
    }
  );
});

describe("Google branding source guardrails", () => {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const childProcess = require("child_process") as typeof import("child_process");
  const repositoryRoot = path.join(__dirname, "../..");
  const signInSource = fs.readFileSync(path.join(repositoryRoot, "src/app/auth/signin/page.tsx"), "utf8");
  const registerSource = fs.readFileSync(path.join(repositoryRoot, "src/app/auth/register/page.tsx"), "utf8");
  const svg = fs.readFileSync(path.join(repositoryRoot, "public/images/google-g-logo.svg"), "utf8");
  const pageSources = `${signInSource}\n${registerSource}`;

  it("uses the official local asset on both pages with no fake text or blue-square G", () => {
    expect(signInSource).toContain('src="/images/google-g-logo.svg"');
    expect(registerSource).toContain('src="/images/google-g-logo.svg"');
    expect(pageSources).not.toMatch(/>\s*G\s*</);
    expect(pageSources).not.toContain("#4285F4");
  });

  it("keeps the SVG script-free, self-contained, font-free, and multicolor", () => {
    expect(svg).not.toMatch(/<script\b/i);
    expect(svg).not.toMatch(/\b(?:href|xlink:href|src)\s*=\s*["']https?:/i);
    expect(svg).not.toMatch(/@font-face|font-family|\.(?:ttf|otf|woff2?)\b/i);
    const colors = new Set(svg.match(/#[0-9A-Fa-f]{6}\b/g) ?? []);
    expect(colors.size).toBeGreaterThan(1);
  });

  it("adds no Google font file and no third-party icon dependency", () => {
    const changedAndUntracked = [
      childProcess.execFileSync("git", ["diff", "--name-only", "ae543794225fae36b7060d5102d76cb728836ee5"], {
        cwd: repositoryRoot,
        encoding: "utf8",
      }),
      childProcess.execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
        cwd: repositoryRoot,
        encoding: "utf8",
      }),
    ].join("\n");
    expect(changedAndUntracked).not.toMatch(/\.(?:ttf|otf|woff2?)\b/i);

    const dependencyDiff = childProcess.execFileSync(
      "git",
      ["diff", "ae543794225fae36b7060d5102d76cb728836ee5", "--", "package.json", "package-lock.json"],
      { cwd: repositoryRoot, encoding: "utf8" }
    );
    expect(dependencyDiff).toBe("");
  });
});
