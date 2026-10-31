import { createHash } from "node:crypto";

export interface FakeIdentity {
  /** The provider's user id (`sub` for Google, numeric id for GitHub). */
  id: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  /** GitHub only: the user's full e-mail list. Defaults to just `email`. */
  emails?: Array<{ email: string; primary: boolean; verified: boolean }>;
}

export interface FakeRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  form?: Record<string, string>;
}

type Provider = "google" | "github";
interface IssuedCode {
  provider: Provider;
  identity: FakeIdentity;
  challenge?: string;
}
type FailTarget = "token" | "profile";
interface Failure {
  status?: number;
  body?: unknown;
  network?: boolean;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Stands in for Google's and GitHub's OAuth servers in tests: a `fetch` implementation that mimics
 * their endpoints - including PKCE verification, single-use codes and each provider's own error style.
 * Any URL it does not know throws, so a test can never talk to the real internet by accident.
 */
export class FakeOAuthServer {
  readonly requests: FakeRequest[] = [];
  private readonly codes = new Map<string, IssuedCode>();
  private readonly accessTokens = new Map<string, IssuedCode>();
  private readonly failures = new Map<FailTarget, Failure>();
  private counter = 0;

  constructor(readonly credentials = { clientId: "test-client-id", clientSecret: "test-client-secret" }) {}

  /** Make the next token/profile call fail (once). */
  failNext(target: FailTarget, failure: Failure): void {
    this.failures.set(target, failure);
  }

  /** Mint a one-time authorization code, as the provider would after the user approves. */
  issueCode(provider: Provider, identity: FakeIdentity, options: { codeChallenge?: string } = {}): string {
    const code = `${provider}-code-${++this.counter}`;
    this.codes.set(code, { provider, identity, ...(options.codeChallenge ? { challenge: options.codeChallenge } : {}) });
    return code;
  }

  /**
   * "The user clicked Allow": reads the authorization URL Forge redirected to and returns the callback
   * path (relative to the API base) the provider would send the browser to.
   */
  approve(authorizationUrl: string, identity: FakeIdentity, apiPrefix = "/api/v1"): string {
    const url = new URL(authorizationUrl);
    const provider: Provider = url.hostname === "accounts.google.com" ? "google" : "github";
    const challenge = url.searchParams.get("code_challenge") ?? undefined;
    const code = this.issueCode(provider, identity, challenge ? { codeChallenge: challenge } : {});
    const redirect = new URL(url.searchParams.get("redirect_uri") ?? "");
    const query = new URLSearchParams({ code, state: url.searchParams.get("state") ?? "" });
    return `${redirect.pathname.replace(apiPrefix, "")}?${query.toString()}`;
  }

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const form = typeof init?.body === "string" ? Object.fromEntries(new URLSearchParams(init.body)) : undefined;
    this.requests.push({ method, url: url.href, headers, ...(form ? { form } : {}) });

    const key = `${method} ${url.host}${url.pathname}`;
    switch (key) {
      case "POST oauth2.googleapis.com/token":
        return this.token("google", form ?? {});
      case "POST github.com/login/oauth/access_token":
        return this.token("github", form ?? {});
      case "GET openidconnect.googleapis.com/v1/userinfo":
        return this.profile("google", headers, (p) => ({
          sub: p.identity.id,
          email: p.identity.email,
          email_verified: p.identity.emailVerified ?? true,
          name: p.identity.name,
          picture: p.identity.picture,
        }));
      case "GET api.github.com/user":
        return this.profile("github", headers, (p) => ({
          id: Number(p.identity.id),
          login: `user${p.identity.id}`,
          name: p.identity.name ?? null,
          avatar_url: p.identity.picture,
          email: null,
        }));
      case "GET api.github.com/user/emails":
        return this.profile("github", headers, (p) =>
          p.identity.emails ?? (p.identity.email ? [{ email: p.identity.email, primary: true, verified: p.identity.emailVerified ?? true }] : []),
        );
      default:
        throw new Error(`FakeOAuthServer: unexpected request ${key}`);
    }
  };

  private takeFailure(target: FailTarget): Response | undefined {
    const failure = this.failures.get(target);
    if (!failure) return undefined;
    this.failures.delete(target);
    if (failure.network) throw new TypeError("fetch failed");
    return json(failure.body ?? { error: "server_error", error_description: "secret internal detail" }, failure.status ?? 500);
  }

  private token(provider: Provider, form: Record<string, string>): Response {
    const injected = this.takeFailure("token");
    if (injected) return injected;

    if (form.client_id !== this.credentials.clientId || form.client_secret !== this.credentials.clientSecret) {
      return provider === "github" ? json({ error: "incorrect_client_credentials" }) : json({ error: "invalid_client" }, 401);
    }
    // GitHub reports failures with HTTP 200 and an `error` field; Google uses 400.
    const bad = (error: string) => (provider === "github" ? json({ error }) : json({ error }, 400));
    const issued = form.code ? this.codes.get(form.code) : undefined;
    if (!issued || issued.provider !== provider) return bad(provider === "github" ? "bad_verification_code" : "invalid_grant");
    this.codes.delete(form.code as string); // single use

    if (issued.challenge) {
      const expected = createHash("sha256").update(form.code_verifier ?? "").digest("base64url");
      if (!form.code_verifier || expected !== issued.challenge) return bad("invalid_grant");
    }
    const accessToken = `${provider}-access-${++this.counter}`;
    this.accessTokens.set(accessToken, issued);
    return json({ access_token: accessToken, token_type: "bearer", scope: "email" });
  }

  private profile(provider: Provider, headers: Record<string, string>, build: (p: IssuedCode) => unknown): Response {
    const injected = this.takeFailure("profile");
    if (injected) return injected;
    const token = headers.authorization?.replace(/^Bearer /i, "");
    const issued = token ? this.accessTokens.get(token) : undefined;
    if (!issued || issued.provider !== provider) return json({ message: "Bad credentials" }, 401);
    return json(build(issued));
  }
}
