# Forge 2

An object-oriented, TypeScript-first Express framework: declare your data and routes, get a secure, tested API.

```ts
import { Forge, collection, fields } from "@starklabs/forge";
import { z } from "zod";

const forge = new Forge({
  jwtSecret: process.env.JWT_SECRET,
  mongoDBURI: process.env.MONGODB_URI,
  isOffline: false,
  collections: [
    collection({
      type: "crud", route: "notes", model: "Note",
      schema: { title: fields.requiredString, owner: fields.userRef },
      validations: { create: { title: z.string().min(1) } },
      routes: [
        { method: "get",  path: "/", handler: "readAll", auth: "admin-or-owner" },
        { method: "post", path: "/", handler: "create",  auth: "authenticated", validation: "create" },
      ],
    }),
  ],
});

await forge.start();            // connects, listens, handles SIGINT/SIGTERM gracefully
```

See [`examples/server.ts`](examples/server.ts) for a fuller app, and [`MIGRATION.md`](MIGRATION.md) if you are coming from 1.x.

Requires Node 20+, Express 5, Mongoose 9, Zod 4.

## Architecture

Everything is a class with explicit dependencies. There are no module-level singletons, and the framework never calls `process.exit`.

```
src/
├─ core/       Forge (lifecycle) · ServiceFactory (wiring) · FeatureModule (base class for features)
│              AccessPolicy · ActionRunner · FieldTransformer · Pagination · ResponseSanitizer
├─ config/     ForgeConfig (validated, immutable) · Duration
├─ errors/     AppError hierarchy · ErrorCode · ErrorTranslator
├─ security/   PasswordHasher (Argon2id) · CryptoVault (field encryption) · TokenService (JWT) · Totp (RFC 6238)
├─ data/       Repository / DataSource interfaces · Mongoose implementation · SchemaCompiler
├─ http/       Authenticator · ErrorHandler · RateLimiters · OriginGuard · InputSanitizer
├─ auth/       AuthService · SessionService · OtpService · MagicLinkService · MfaService · LoginCompleter
│              AccountLinkPolicy · UserProvisioner · AuthServices (lazy wiring) · controllers · AuthModule
├─ oauth/      OAuthProvider (base) · GoogleProvider · GitHubProvider · OAuthProviderRegistry · OAuthService
├─ crud/       CrudController · FileController · CrudModule        account/ (profile + role check) admin/ (deprecated) health/
├─ email/      EmailService · TemplateRenderer (45 templates) · providers
├─ upload/     UploadService · StorageProvider · CloudinaryStorage · FileTypeSniffer
└─ testing/    InMemoryDataSource · FakeEmailProvider · FakeStorage · createTestForge · TestClient
```

A request flows: `request-id → helmet → CORS → compression → rate limit → body parsers → cookies → input sanitiser → origin guard → [collection: strict limiter → authenticator → upload parser → handler] → 404 → error handler`.

### Extension points

| To change…             | Implement / subclass                          | Pass it                                  |
| ---------------------- | --------------------------------------------- | ---------------------------------------- |
| Database               | `DataSource` + `Repository`                   | `new Forge(opts, { dataSource })`        |
| E-mail delivery        | `EmailProvider`                               | `new Forge(opts, { emailProvider })`     |
| File storage           | `StorageProvider` (e.g. S3)                   | `new Forge(opts, { storageProviders })`  |
| Logging                | `LogSink` with `new Logger(level, sink)`      | `new Forge(opts, { logger })`            |
| A login provider       | extend `OAuthProvider` (~20 lines)            | `auth.oauth.providers: [new MyProvider(…)]` |
| A whole new feature    | extend `FeatureModule`                        | `forge.use(new MyModule(forge.services))`|
| Rate-limit storage     | an `express-rate-limit` `Store` (e.g. Redis)  | `rateLimitStore` option                  |

```ts
class ReportsModule extends FeatureModule {
  readonly type = "reports";
  protected handlers() {
    return { summary: async (req, res, ctx) => this.services.responses.success(res, { message: "ok", data: {} }) };
  }
}
forge.use(new ReportsModule(forge.services));      // then: collection({ type: "reports", route: "reports", routes: [...] })
```

Custom handlers can use `services.findModel("Report")` to resolve a registered model by name to its framework-neutral repository.

## Collections and routes

| `type`    | Handlers                                                                                                   | Default `auth`  |
| --------- | ---------------------------------------------------------------------------------------------------------- | --------------- |
| `crud`    | `read` `readAll` `create` `createBulk` `update` `remove` `removeMultiple` `removeAll` `addFile` `updateFile` `deleteFile` | `authenticated` |
| `auth`    | `signup` `login` `verifyOTP` `resendOTP` `forgotPassword` `resetPassword` `refresh` `logout` `authMethods` `magicLinkRequest` `magicLinkVerify` `oauthProviders` `oauthStart` `oauthCallback` `mfaStatus` `mfaSetup` `mfaEnable` `mfaVerify` `mfaDisable` `mfaRecoveryCodes` | `public`        |
| `account` | `getMe` `updateMe` `deleteMe` `checkRole`                                                                  | `authenticated` |
| `admin` *(deprecated)* | `checkRole` (`checkAdmin` is the old name)                                                    | `admin`         |
| `health`  | `healthGet` `healthPost` `healthPut` `healthPatch` `healthDelete`                                          | `public`        |

`auth` levels (who may call it): `public` · `authenticated` · `admin` · `admin-or-owner` (admins, or the owner of the document).
`roles` (which kind of user may call it): `roles: ["editor", "admin"]`. See [Roles](#roles).

Route options: `roles`, `validation` (name of a group in `validations`, or `false`), `config` (`populate`, `populateSelect`, `hiddenFields`, `targetField`, `maxBulkSize`), `files`, `encryptedFields`, `decryptedFields`, `hashedFields` (suffix `?` = optional), `actions` (`before` / `after`), `ownership`, `mode`. Hashed fields are hidden on every route in their collection by default; a response route can include `config.hiddenFields: ["!pin"]` to explicitly return the stored hash. Encrypted fields remain hidden unless that route declares the field in `decryptedFields`; `"!secret"` opts it out of `hiddenFields` so its decrypted value can be returned.

Everything is validated **at startup**: unknown handlers, unknown validation names, bad action shapes, `removeAll` on a non-admin route and more are reported together in one `ConfigurationError`.

### Actions

```ts
actions: {
  before: [{ customAction: (ctx) => { if (!ctx.user) throw new ForbiddenError({ message: "no" }); } }],   // may abort
  after:  [
    { customAction: (ctx) => ({ ...ctx.item, extra: true }) },        // a returned value replaces result.data
    { emailAction: { from: "system-email-sender", to: "ops@acme.dev", type: "raw", rawBody: "<p>Hi</p>", subject: "New item" } },
  ],
}
```

`after` actions run once the data is saved, so a failure is logged and does not turn a successful write into an error response.
In an `after` action, `ctx.item` is the returned item (or items), while `ctx.result` is the mutable response body, including `success`, `message`, `data`, and any pagination metadata. You can edit `ctx.result.message` or `ctx.result.meta`; returning a value still replaces `ctx.result.data`.

Actions also receive the Express response as `ctx.res`, so an app can create and send its own signed token outside Forge's built-in session flow:

```ts
after: [{
  customAction: ({ res, item }) => {
    const tokenAge = Duration.parse("1h");
    const token = forge.services.tokens.signCustom(
      { sub: (item as { _id: string })._id, accountId, permissions },
      tokenAge,
    );
    forge.services.cookies.setCustom(res, "workspace-token", token, {
      maxAge: tokenAge.toMs(),
    });
  },
}]
```

`signCustom()` uses Forge's configured JWT secret, issuer, and pinned algorithm, and adds `typ: "custom"`. Forge manages the standard JWT claims and `typ`; pass application claims and the lifetime. `setCustom()` applies Forge's configured secure, HttpOnly, same-site, path, and domain cookie defaults; supplied cookie options override those defaults.

Protect custom endpoints with the matching verifier middleware:

```ts
app.get("/workspace", forge.customAuth(), (req, res) => {
  // Verified application claims are available on req.customToken.
  res.json({ accountId: req.customToken?.accountId });
});

app.get("/integration", forge.customAuth({
  name: "workspaceClaims",
  cookieName: "workspace-token",
  extractToken: (req) => req.get("x-workspace-token") ?? req.cookies?.["workspace-token"],
}), handler);
```

`customAuth()` accepts only tokens signed by `signCustom()`. It attaches the verified claims to `req.customToken` by default; pass `name` to use another request property. Its default token source is a Bearer token followed by the `customToken` cookie. `extractToken` can read from any request source. This middleware does not set `req.user`; use it when controllers need the custom token claims directly.

### Pagination

`GET /notes?page=2&limit=20&sort=-createdAt,title` → `{ data: [...], meta: { page, limit, total, pages } }`. Page size is capped by `maxPageSize` (100); `sort` accepts only schema fields.

## Sign-in methods

Every way of signing in is optional, can be combined, and ends in the same place, so the same account rules and second-factor check apply to all of them.

| Method | Enable with | Notes |
| --- | --- | --- |
| Password | `auth.signupMode` / `loginMode: "credentials"` | Argon2id, lockout-free but rate limited |
| Password + e-mailed code | `signupMode` / `loginMode: "otp"` | Code is checked after the password |
| **Magic link** | `auth.magicLink` | Passwordless, below |
| Social (Google, GitHub, your own) | `auth.oauth` | See "Social sign-in" |
| **Authenticator app (2FA)** | `auth.mfa` | A second step after the password / e-mailed code / magic link; below |

`GET /auth/methods` tells the front-end what is enabled: `{ password, magicLink, oauth: [...], mfa }`.

### Magic link

```ts
auth: {
  /* … */
  magicLink: {
    url: "https://app.example.com/auth/magic",   // front-end page that receives ?token=…  (must be on frontendURL(s))
    expiresIn: "15m", resendCooldown: "60s",
    allowSignup: true,                            // unknown e-mail creates an account on first use
    sameDevice: true,                             // link only works in the browser that asked for it
  },
},
frontendURL: "https://app.example.com",
```

1. `POST /auth/magic-link` `{ email, name? }`: always answers `200`, whether or not the address has an account.
2. The user gets an e-mail with `https://app.example.com/auth/magic?token=…`.
3. Your page reads the token and calls `POST /auth/magic-link/verify` `{ token }`: it answers like a login (`201` for a new account, `200` otherwise, session cookies set). If the user has two-factor on, it answers `{ mfaRequired: true, mfaToken }` instead.

Why it works this way:

- **The link must not sign anyone in by itself.** Mail scanners "click" links with `GET`; if that redeemed or burned the token, the feature would break (or be abused). Redemption is a `POST` from your page, and there is no `GET` route.
- **No account enumeration.** Same response and same cookie for every address; mail-provider failures are logged, not reported.
- **Login-CSRF protection** (`sameDevice`): the link is bound to the browser that requested it by an HttpOnly cookie, so an attacker cannot mail *their own* link to a victim and sign them in to the attacker's account. Another browser gets `400 MAGIC_LINK_DEVICE_MISMATCH` *without* burning the link. Turn it off for mobile apps or cross-device use.
- **256-bit token, stored hashed, single use, 15 minutes.** Redeeming deletes it first, so of two simultaneous attempts exactly one wins. Expired, used and invented links are indistinguishable.
- **Existing accounts** follow `accountLinking` (`"auto" | "always" | "never"`, same rule as social sign-in): by default a link only signs in to an account whose e-mail was verified at sign-up, because of account pre-hijacking.

### Two-factor authentication (authenticator apps)

```ts
auth: { /* … */ mfa: { issuer: "Acme" } },
masterKey: process.env.MASTER_KEY,     // required: authenticator secrets are encrypted at rest
```

| Step | Route (auth) | |
| --- | --- | --- |
| Start | `POST /auth/mfa/totp/setup` (signed in) | returns `{ secret, otpauthUrl }`: render `otpauthUrl` as a QR code |
| Activate | `POST /auth/mfa/totp/enable` `{ code }` | returns **10 recovery codes, once** |
| Sign in | any first factor returns `{ mfaRequired: true, mfaToken }`, then `POST /auth/mfa/verify` `{ mfaToken, code }` or `{ mfaToken, recoveryCode }` | session starts here |
| Status | `GET /auth/mfa` | `{ enabled, recoveryCodesRemaining }` |
| Disable | `POST /auth/mfa/disable` `{ code }` or `{ recoveryCode }` | needs proof |
| New recovery codes | `POST /auth/mfa/recovery-codes` `{ code }` or `{ recoveryCode }` | old set stops working |

- Applies to password, e-mailed-code and magic-link sign-ins. No session, cookie or token exists until the second step succeeds.
- Codes are RFC 6238 (6 digits, 30 s, ±1 step): works with Google Authenticator, Authy, 1Password, etc.
- **A code works once** (the accepted time step is stored). Wrong codes are counted per account; after `maxAttempts` (5) the factor locks for `lockoutDuration` (5 min) with `429 MFA_LOCKED`, which per-IP limits alone cannot give you against a distributed guess.
- State changes are compare-and-set, so two simultaneous requests cannot both spend the same code or recovery code.
- Secrets are encrypted with the master key, recovery codes are stored as hashes, and deleting the account removes them.
- **Not covered:** social sign-in is not gated by Forge's second factor (the provider's own protections apply). Passkeys/WebAuthn and SMS codes are not included.

### Adding another sign-in method

A method is a service plus one lazy getter. Prove who the user is, then **end in `LoginCompleter.complete(user, req)`**: it decides whether a session starts now or a second factor comes first, so the new method cannot forget it.

```ts
// 1. src/auth/MyMethodService.ts: verify the credential, find or create the user (UserProvisioner, AccountLinkPolicy)
return this.completer.complete(user, req, { created });
// 2. src/auth/AuthServices.ts: add a lazy getter
// 3. a controller + handler names, and (optionally) built-in routes in BuiltinCollections
```

## Roles

A user's role is a string on their record (`role: fields.role` gives you `guest · user · moderator · editor · author · support · manager · admin · super_admin · owner`, or use your own). Two things use it.

**1. Restrict a route to specific roles** with `roles`. It is checked after `auth`, so both must pass, and the role is read from the database on every request: promoting or demoting someone takes effect immediately.

```ts
{ method: "post",   path: "/",              handler: "create", auth: "authenticated", roles: ["editor", "admin"], validation: "create" },
{ method: "delete", path: "/delete/:id",    handler: "remove", auth: "authenticated", roles: ["moderator"] },
{ method: "patch",  path: "/update/:id",    handler: "update", auth: "admin-or-owner", roles: ["editor", "admin"] },   // must be an editor/admin AND the owner (or an admin)
```

- Matching is **exact and case-sensitive**, and admins are **not** implicitly included: list `"admin"` yourself where admins may call the route. (Use `auth: "admin"` for "administrators only"; it means the roles in `adminRoles`, default `["admin"]`.)
- Anonymous callers get `401`; a signed-in user with the wrong role gets `403 ROLE_NOT_ALLOWED` (the hint listing allowed roles is shown outside production only).
- Checked **at startup**: `roles` on a `public` route, combined with `auth: "admin"`, empty or malformed, or used with `verifyAccessUser: false` (no role would ever be loaded) is refused with a clear message.

**2. Ask "what is my role?"** with `GET /account/role` (any signed-in user, any role), for example to decide which screens a front-end shows. The server still enforces access on every route; this is information, not authorisation.

```json
{ "success": true, "message": "Role found successfully.", "data": { "role": "editor", "isAdmin": false } }
```

`isAdmin` is true when the role is in `adminRoles`. An account with no role gets `404 ROLE_NOT_FOUND` (add `role: fields.role` to the user schema). Inside your own actions the same information is `ctx.user.role`.

> **Renamed in 2.0.** The role check used to be called `checkAdmin` (`GET /admin/check`, admins only) although it returned whatever role the caller had; 2.0 first dropped the role from the response. It is now `checkRole` at `GET /account/role`, open to every role, and returns `{ role, isAdmin }`. The old names (`type: "admin"`, `builtinConfig.admin`, `checkAdmin`) keep working and log a deprecation warning. The `AuthRole` type is now `AccessLevel` (it describes *who may call a route*, not a user's role); the old name is a deprecated alias.

## Social sign-in (Google, GitHub, …)

```ts
builtinConfig: {
  auth: {
    mode: "builtin",
    /* …mongooseConfig, signupMode… */
    oauth: {
      providers: [
        { provider: "google", clientId: process.env.GOOGLE_ID!, clientSecret: process.env.GOOGLE_SECRET! },
        { provider: "github", clientId: process.env.GITHUB_ID!, clientSecret: process.env.GITHUB_SECRET! },
      ],
      successRedirect: "https://app.example.com/welcome",   // optional: omit to get the session as JSON
      failureRedirect: "https://app.example.com/login",     // optional: gets ?error=<CODE>
    },
  },
},
frontendURL: "https://app.example.com",   // redirect targets must be on a configured front-end
backendURL: "https://api.example.com/api/v1",
```

Three routes are added to the auth collection automatically:

| Route | Purpose |
| --- | --- |
| `GET /auth/oauth/providers` | `[{ name, displayName, url }]`: render your buttons from this |
| `GET /auth/oauth/:provider[?returnTo=/path]` | link the button to this; it redirects to the provider |
| `GET /auth/oauth/:provider/callback` | register `<backendURL>/auth/oauth/<provider>/callback` as the redirect/callback URL at the provider |

The callback sets the same session cookies as a password login, then redirects (or returns JSON when no `successRedirect` is set).

**How an account is chosen.** A returning user is recognised by the provider's stable user id. For a first sign-in with an e-mail that already has a local account, `accountLinking` decides:

| `accountLinking` | Behaviour |
| --- | --- |
| `"auto"` (default) | Link only if every local e-mail was verified at sign-up (`signupMode: "otp"`). Otherwise `409 ACCOUNT_LINK_BLOCKED`. |
| `"always"` | Link whenever the provider says the e-mail is verified. |
| `"never"` | Never link. |

The `auto` default exists because of *account pre-hijacking*: with password sign-up that doesn't verify e-mails, an attacker can register `victim@x.com` first and share the account once the victim signs in with Google. Provider e-mails that are not **verified** are always refused (`403 OAUTH_EMAIL_UNVERIFIED`).

New users get a random, never-disclosed password (they can set one through "forgot password"). If your schema requires more than `name` and `email`, add `userFromProfile: (profile) => ({ username: … })`.

**Security.** Random `state` bound to the browser by a signed, short-lived, HttpOnly `SameSite=Lax` cookie (login-CSRF protection); PKCE (S256) on every provider that supports it; single-use state; only same-site `returnTo` paths and allow-listed redirect origins (no open redirect); provider errors reduced to a short code (no upstream bodies or secrets); no redirects followed while credentials are attached; the endpoints share the strict per-IP limiter.

### Adding another provider

Subclass `OAuthProvider`. The base class does the authorization URL, PKCE, code exchange, timeouts and error mapping; you supply the endpoints and how to read the profile.

```ts
import { OAuthProvider, type OAuthProfile, type TokenSet } from "@starklabs/forge";

class DiscordProvider extends OAuthProvider {
  readonly name = "discord";                    // URL segment: /auth/oauth/discord
  readonly displayName = "Discord";
  protected readonly authorizationEndpoint = "https://discord.com/oauth2/authorize";
  protected readonly tokenEndpoint = "https://discord.com/api/oauth2/token";
  protected readonly defaultScopes = ["identify", "email"] as const;

  async fetchProfile(tokens: TokenSet): Promise<OAuthProfile> {
    const res = await this.getJson("https://discord.com/api/users/@me", tokens);
    const me = this.asRecord(res.body);
    if (!res.ok || typeof me.id !== "string") throw this.failure("profile request", res.status);
    return { providerUserId: me.id, email: me.email as string, emailVerified: me.verified === true, name: me.username as string };
  }
}

oauth: { providers: [google, new DiscordProvider({ clientId, clientSecret })] }
```

Override `usesPkce = false` for providers that reject PKCE parameters, or `scopeSeparator` / `defaultAuthorizationParams` for provider quirks. Everything else (state, e-mail verification, linking rules, sessions, rate limits) applies to your provider automatically.

## Errors

Every failure has the same shape and a stable, machine-readable `code`:

```json
{ "success": false, "message": "title: Too small", "code": "VALIDATION_FAILED",
  "issues": [{ "path": "title", "message": "Too small", "code": "too_small" }], "requestId": "…" }
```

`hint` and `details` are included outside production (`exposeErrorDetails`). Unexpected errors are logged with their stack and returned as a generic `500`.

| Status | Codes |
| ------ | ----- |
| 400 | `BAD_REQUEST` `INVALID_JSON` `INVALID_OBJECT_ID` `INVALID_QUERY` `OTP_INVALID` `OTP_EXPIRED` `RESET_TOKEN_INVALID` `UPLOAD_REQUIRED` `UPLOAD_TOO_MANY_FILES` `UPLOAD_FIELD_NOT_FOUND` `UPLOAD_FAILED` `MAGIC_LINK_INVALID` `MAGIC_LINK_DEVICE_MISMATCH` `MFA_SETUP_REQUIRED` `OAUTH_STATE_INVALID` `OAUTH_CODE_INVALID` `OAUTH_EMAIL_MISSING` `INVALID_EMAIL_SENDER` `INVALID_EMAIL_RECIPIENT` `EMAIL_ACTION_INVALID` |
| 401 | `ACCESS_TOKEN_MISSING` `ACCESS_TOKEN_INVALID` `ACCESS_TOKEN_EXPIRED` `ACCESS_USER_NOT_FOUND` `REFRESH_TOKEN_MISSING` `REFRESH_TOKEN_INVALID` `REFRESH_TOKEN_EXPIRED` `REFRESH_TOKEN_REVOKED` `REFRESH_TOKEN_REUSED` `REFRESH_TOKEN_ROTATED` `REFRESH_TOKEN_NOT_FOUND` `REFRESH_USER_NOT_FOUND` `INVALID_CREDENTIALS` `MFA_CHALLENGE_INVALID` `MFA_CODE_INVALID` `OAUTH_ACCESS_DENIED` |
| 403 | `FORBIDDEN` `ADMIN_REQUIRED` `OWNER_REQUIRED` `ROLE_NOT_ALLOWED` `CSRF_ORIGIN_REJECTED` `OAUTH_EMAIL_UNVERIFIED` |
| 404 | `ROUTE_NOT_FOUND` `RESOURCE_NOT_FOUND` `FILE_NOT_FOUND` `OTP_NOT_FOUND` `USER_NOT_FOUND` `ROLE_NOT_FOUND` `OAUTH_PROVIDER_NOT_FOUND` |
| 409 | `DUPLICATE_KEY` `USER_ALREADY_EXISTS` `CONFLICT` `ACCOUNT_LINK_BLOCKED` `MFA_ALREADY_ENABLED` `MFA_NOT_ENABLED` |
| 413 | `PAYLOAD_TOO_LARGE` `UPLOAD_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` `UPLOAD_INVALID_TYPE` |
| 422 | `VALIDATION_FAILED` `FIELD_MISSING` |
| 429 | `MFA_LOCKED` `RATE_LIMITED` `OTP_RESEND_COOLDOWN` `OTP_RESEND_LIMIT` `OTP_ATTEMPTS_EXCEEDED` |
| 502 | `OAUTH_PROVIDER_ERROR` |
| 500 / 503 | `INTERNAL_ERROR` `CONFIGURATION_ERROR` `ENCRYPTION_FAILED` `DECRYPTION_FAILED` `EMAIL_TEMPLATE_ERROR` · `DATABASE_UNAVAILABLE` `SERVICE_UNAVAILABLE` `EMAIL_SEND_FAILED` |

Throw the classes (`NotFoundError`, `ForbiddenError`, `ConflictError`…) from your own actions: the status and response shape come for free.

## Security model

- **Passwords**: Argon2id (libsodium). 1.x hashes still verify and are upgraded transparently on the next login. Passwords are 8–128 characters.
- **Login** answers identically for "no such user" and "wrong password", and burns the same CPU time for unknown accounts.
- **Tokens**: HS256 pinned, issuer checked, `typ` claim separates access from refresh tokens. The access token is read from `Authorization: Bearer` or its cookie, never from the body.
- **Sessions**: refresh tokens are stored as SHA-256 hashes and **rotated** on use. Replaying a rotated token (outside a short grace period for racing tabs) revokes the whole session family. Logout and password change/reset revoke sessions.
- **One-time codes**: CSPRNG, stored as keyed hashes, expire on their own (TTL), limited attempts, resend cooldown and cap. Password reset swaps the code for a separate single-use token.
- **Authorisation**: `auth` levels plus per-route `roles` (exact match, role read from the database on every request, validated at startup). `admin-or-owner` lists are filtered in the database; single documents are checked individually. `protectedFields` (default `role`) can only be written by admins. The document owner always comes from the session.
- **Responses**: passwords, hashes, tokens and sealed values are removed everywhere; populated references return `_id` only unless `populateSelect` says otherwise.
- **Input**: `$operator` / dotted / `__proto__` keys are stripped; every body is parsed through Zod (unknown keys dropped); ids must be 24-hex; sort fields are whitelisted; body size is limited.
- **Browser**: Helmet, strict CORS (nothing allowed unless you configure origins), CSRF origin check for cookie sessions, HttpOnly cookies, SameSite/Secure defaults by environment, no state-changing GET routes.
- **Rate limiting**: a global limit plus a stricter, *shared* per-IP limit for sign-up, login, OTP and password-reset.
- **Magic links & two-factor**: single-use hashed tokens bound to the requesting browser, no enumeration, no GET redemption; TOTP with replay protection, per-account lockout, encrypted secrets, hashed recovery codes (see above).
- **Social sign-in**: state + PKCE, verified e-mails only, safe account linking, no open redirects (see above).
- **Uploads**: size/count limits, MIME allow-list, **content sniffing** (a script renamed `.png` is rejected), cleanup of orphaned files on failure.
- **E-mail**: every template value is HTML-escaped and links are limited to `http(s)`/`mailto`; headers can't be injected; the IP shown in security e-mails comes from `req.ip` (set `trustProxy` behind a load balancer).
- **Startup**: weak/missing secrets, offline mode in production and `SameSite=None` without `Secure` fail fast.

## Testing your app

```ts
import { createTestForge } from "@starklabs/forge/testing";

const t = await createTestForge({ collections: [notes] });   // random port, in-memory DB, fake mailer & storage
const res = await t.client.post("/notes", { title: "hi" });  // cookie-aware fetch client
t.email.lastCode("a@b.co");                                  // read the OTP the app "sent"
t.email.lastMagicToken("a@b.co");                            // …or the magic-link token
new Totp().codeAt(secret);                                   // the code an authenticator app would show
t.oauth.approve(location, { id: "1", email: "a@b.co" });     // fake Google/GitHub: returns the callback path for a sign-in
await t.close();
```

## Development

```bash
npm test                 # 765 tests
npm run test:coverage
npm run typecheck
npm run build
```
