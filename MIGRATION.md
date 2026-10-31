# Migrating from Forge 1.x to 2.0

Most apps need three changes: the entry point, three renamed/changed options, and any code relying on the behaviours below.

## 1. Entry point

```diff
- import { StarkForge, startServer } from "@starklabs/forge";
- new StarkForge({ ...options });
- startServer();
+ import { Forge } from "@starklabs/forge";
+ const forge = new Forge({ ...options });
+ await forge.start();
```

`StarkForge` and `startServer()` still work (deprecated). The old module-level `app` export is gone: use `forge.app` (an Express instance) before calling `start()`, or `forge.build()` for tests.

The framework no longer calls `process.exit()`. Bad configuration throws a `ConfigurationError` listing **all** problems.

**Removed exports**

| 1.x | 2.0 |
| --- | --- |
| `app` | `forge.app` (the Express app of your `Forge` instance) |
| `getModel({ model, ... })` | `forge.services.data.nativeModel?.("Product")` for the Mongoose model (it returns `unknown`, so cast it), or `forge.services.data.repository("Product")` for the database-agnostic repository. Models exist once the app is built, so call `forge.build()` (or `await forge.start()`) first. Inside an action, use `ctx.Model` or `ctx.repository`. |
| `getItem({ model, _id, ... })` | `await forge.services.data.repository("Product").findById(id)` (or `.find({})`). Inside an action, `ctx.repository.findById(id)`. |

## 2. Options

| 1.x | 2.0 |
| --- | --- |
| `maxReqLimit: 999999…` | default `100` per window; add `authMaxReqLimit` (default 20) for credential endpoints |
| `"0s"` duration meant 1 second | means 0 |
| `jwtSecret` any length | at least 32 characters (`generateJWTSecret()`) |
| `masterKey` any string | base64 32-byte key (`generateMasterKey()`, which now **returns** the key) |
| `frontendURL(s)` accepted but **unused** | now configure CORS (with credentials) and the CSRF origin check; `corsConfig` still overrides |
| password ≥ 6 | password 8–128 (existing users with shorter passwords can still log in) |
| `domain` (cookie domain, required and applied only in production) | `builtinConfig.auth.cookie.domain`. The old `domain` option still works in production and logs a deprecation warning; outside production it is ignored, as before. Host-only cookies (no `domain`) are now the default and the safest choice. |

New: `adminRoles`, `protectedFields`, `trustProxy`, `bodyLimit`, `defaultPageSize`/`maxPageSize`, `uploadMaxFileSize`/`uploadMaxFiles`, `rateLimitStore`, `exposeErrorDetails`, `auth.otp.*`, `auth.refreshReuseGracePeriod`, `auth.cookie.*`.

## 3. Behaviour changes

**API surface**
- `POST /auth/verify-otp` and `reset-password` are public. The 1.x built-in routes declared them `authenticated`, although the caller has no session yet at that point.
- The `GET` variants of `/auth/logout` and `/auth/refresh-token` are removed (the `POST` ones stay). State-changing GETs are CSRF-able. Logout no longer needs a valid access token.
- `POST /auth/reset-password` takes `{ email, resetToken, password }`. `resetToken` is returned by `verify-otp` for `purpose: "password_reset"`.
- `POST /auth/forgot-password` always answers 200.
- `GET` list routes return `{ data, meta }` and **paginate** (`page`, `limit`, `sort`). An empty collection is `200 []`, not 404.
- Validation failures are **422** (1.x used 409); malformed ids and JSON are 400; duplicate keys are 409; server misconfiguration is 500 (1.x used 404/409).
- Every error carries a `code`; see the README table.
- Updating a profile password requires `currentPassword`, and closes all sessions.

**Data**
- `populate` returns only `_id` by default; set `config.populateSelect: "_id name"` to return more.
- Password fields use `select: false`; query them explicitly with `{ withSecrets: ["password"] }`.
- OTP codes and pending sign-ups live in a `ForgeOtpRequest` collection (TTL-indexed), and refresh tokens in `ForgeRefreshToken` (SHA-256 hashed). Old 1.x token/OTP collections are not read; users must sign in again once.
- Stored password hashes keep working and are upgraded on next login. Encrypted fields keep the same stored format.

**Actions**
- Hooks are `{ customAction }` / `{ emailAction }`. The context gained `operation`, `item`, `result`, `repository`.
- `after` hooks no longer fail the request; failures are logged. All hooks are awaited.
- E-mail template values are HTML-escaped. If you relied on passing HTML in a template field, use `type: "raw"` with `rawBody`.

**Access control**
- `admin-or-owner` list routes return only the caller's documents (1.x returned everything when the first item matched).
- `role` (and any `protectedFields`) can only be set by administrators, including at signup.
- `removeAll` is rejected at startup unless the route is `admin`/`admin-or-owner`.
- Admin checks use `adminRoles` instead of the literal `"admin"`.

**The role check (`checkAdmin`) is renamed and fixed**
- 1.x: `checkAdmin` at `GET /admin/check`, admins only, returned `{ role }`. The name was wrong (it reported *any* role) and the admin-only route meant non-admins could never ask for theirs.
- 2.0: `checkRole` at `GET /account/role`, **any signed-in user, any role**, returns `{ role, isAdmin }`; `404 ROLE_NOT_FOUND` if the account has no role.
- Still working, but deprecated (a warning is logged at startup): `builtinConfig.admin` (`GET /admin/check`, now also returns `{ role, isAdmin }`), `type: "admin"` collections, and the handler name `checkAdmin`. Rename `checkAdmin` to `checkRole`, and move it to a `type: "account"` collection.
- The `AuthRole` type is now `AccessLevel`; `AuthRole` remains as a deprecated alias.
- New: `roles: [...]` on any route restricts it to specific roles (see the README).
- New startup check: routes that need a role (`roles`, `auth: "admin"`, `"admin-or-owner"`) are refused when `auth.verifyAccessUser` is `false`, which in 1.x silently locked every admin out.

## 4. New: social sign-in

Optional and additive: add `auth.oauth` (see the README) to enable "Sign in with Google / GitHub" and your own providers. It adds three `GET` routes and a `ForgeOAuthIdentity` collection; nothing changes for apps that do not configure it.

## 5. New: magic link and two-factor

Also optional and additive (`auth.magicLink`, `auth.mfa`; see the README). Enabling `mfa` requires a `masterKey`. Existing sign-in flows behave exactly as before for users who have not turned two-factor on.

## 6. Testing

`@starklabs/forge/testing` replaces the need for a database in tests. See the README.
