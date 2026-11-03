# Forge update migration brief

Use this brief when carrying the Forge changes from this codebase into the next framework update.

## Route actions for every feature type

- `Route.actions.before` and `Route.actions.after` must be supported for every route type, including `crud`, `auth`, `account`, `admin`, `health`, and custom `FeatureModule` routes.
- Validate action shapes during route registration for every module, as the current `FeatureModule.register()` does.
- Run `before` actions before the route handler. Await them and let thrown errors abort the request. Preserve the current behavior where a returned object is merged into `req.body`.
- Run `after` actions after successful handler work but before the response is committed. Await them. A custom action's returned value replaces `result.data`; edits to `result` also affect the response. After-action failures are logged and must not turn completed work into a failed response.
- Keep CRUD's operation-specific action contexts and timing around CRUD operations. Ensure other feature types receive the same hook behavior through the shared feature route pipeline.
- Make sure after actions work with response types beyond ordinary JSON if a route sends redirects or otherwise completes without `res.json()`.

## Express response in action context

- Expose the active Express `Response` as `ctx.res` in `ActionContext` for actions on all feature types.
- This lets an after action set cookies or headers, for example:

  ```ts
  after: [{
    customAction: ({ res }) => {
      res.cookie("session", token, { httpOnly: true, secure: true, sameSite: "lax" });
    },
  }],
  ```

- Provide the response before it is sent so cookie/header changes reach the client. `ctx.req` remains available as well.

## App-created signed tokens and cookies

- Expose a public custom-token API alongside the existing access/refresh token helpers, for use by application code outside Forge's built-in login/session flow.
- Let the caller pass the claims/payload and token lifetime/config required for their use case. Sign with Forge's configured JWT secret and the same pinned algorithm/issuer policy as built-in tokens, without treating a custom token as an access or refresh token.
- Provide a cookie helper alongside `forge.services.cookies.set()` for writing an app-created token to the active response. It should accept a caller-chosen cookie name and token value, default to Forge's configured cookie security attributes, and allow explicit cookie options such as max age when needed.
- Typical usage from an action should be possible without implementing custom signing or manually duplicating the cookie security settings:

  ```ts
  const token = forge.services.tokens.signCustom(claims, { expiresIn });
  forge.services.cookies.setCustom(ctx.res, "my-token", token, { maxAge: expiresIn.toMs() });
  ```

- Keep naming/signature aligned with the current `forge.services.tokens` and `forge.services.cookies` APIs. Add a matching verification helper only if custom tokens need to be validated by Forge later; signing and setting the cookie are the requested first use case.

## Model lookup API

- Keep model lookup on the existing public service API: `forge.services.findModel("User")` returns the framework-neutral `Repository` for a registered model.
- Do not add a separate `forge.findModel()` convenience method. The separate method was added and then removed at the user's request because `forge.services.findModel()` already exists.
- Ensure models are registered early enough that application setup can call `forge.services.findModel(...)` before `forge.start()`; users reported `Model 'User' is not registered` when looking up the model during setup. Register model schemas during Forge configuration/construction or provide an equivalent initialization step that does not require opening the database connection. Preserve registration of internal auth models and custom feature collections.

## Verification

- Add or update tests for before/after hooks on auth and at least one non-auth non-CRUD route, including before-action body merging, after-action response replacement, and setting a cookie through `ctx.res`.
- Verify `forge.services.findModel()` works before `start()` with the default MongoDB data source and with the in-memory test data source.
- Run type checking and the relevant route/action and auth tests.
