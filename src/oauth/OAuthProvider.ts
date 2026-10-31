import { BadGatewayError, BadRequestError, ConfigurationError, ErrorCode } from "../errors/index.js";

/** Credentials and tweaks every provider accepts. */
export interface OAuthClientOptions {
  clientId: string;
  clientSecret: string;
  /** Replaces the provider's default scopes. */
  scopes?: string[];
  /** Extra authorization-URL parameters (e.g. Google `prompt: "select_account"`). Security parameters cannot be overridden. */
  authorizationParams?: Record<string, string>;
  /** Inject a custom `fetch` (tests, proxies, retries). */
  fetch?: typeof fetch;
  /** Network timeout for calls to the provider. @default 10000 */
  timeoutMs?: number;
}

/** What the provider returned from the token endpoint. */
export interface TokenSet {
  accessToken: string;
  tokenType?: string | undefined;
  scope?: string | undefined;
  idToken?: string | undefined;
  raw: Record<string, unknown>;
}

/** The provider-independent view of "who just signed in". */
export interface OAuthProfile {
  /** The provider's stable user id (never the e-mail address). */
  providerUserId: string;
  email?: string | undefined;
  /** True only if the *provider* vouches that the user controls `email`. */
  emailVerified: boolean;
  name?: string | undefined;
  avatarUrl?: string | undefined;
}

export interface AuthorizationParams {
  state: string;
  redirectUri: string;
  /** PKCE S256 challenge. Ignored when the provider does not support PKCE. */
  codeChallenge?: string | undefined;
}

export interface ProviderResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

/** Parameters the framework controls: configuration can never weaken or replace them. */
const RESERVED = new Set(["response_type", "client_id", "redirect_uri", "scope", "state", "code_challenge", "code_challenge_method"]);

/** Token-endpoint errors that mean "this code is no good" (user can simply retry) rather than "the provider is broken". */
const CODE_ERRORS = new Set(["invalid_grant", "bad_verification_code"]);

/**
 * Base class for "Sign in with ..." providers (OAuth 2.0 authorization-code flow).
 *
 * It implements everything the providers share - authorization URL, PKCE, the code
 * exchange and error mapping. A concrete provider only declares its endpoints and how
 * to turn the access token into an {@link OAuthProfile}. See `GoogleProvider` and
 * `GitHubProvider`; a new provider is typically 40 lines.
 */
export abstract class OAuthProvider {
  /** URL segment and identifier: lowercase letters, digits and dashes (e.g. `"google"`). */
  abstract readonly name: string;
  /** Human-readable name for buttons ("Google"). */
  abstract readonly displayName: string;

  protected abstract readonly authorizationEndpoint: string;
  protected abstract readonly tokenEndpoint: string;
  protected abstract readonly defaultScopes: readonly string[];

  /** Set to `false` for providers that reject PKCE parameters. State protection stays on. */
  readonly usesPkce: boolean = true;
  protected readonly scopeSeparator: string = " ";
  /** Parameters this provider always adds to the authorization URL. */
  protected readonly defaultAuthorizationParams: Readonly<Record<string, string>> = {};

  constructor(protected readonly options: OAuthClientOptions) {
    if (!options.clientId || typeof options.clientId !== "string") {
      throw new ConfigurationError({ message: "An OAuth provider needs a non-empty 'clientId'." });
    }
    if (!options.clientSecret || typeof options.clientSecret !== "string") {
      throw new ConfigurationError({ message: "An OAuth provider needs a non-empty 'clientSecret'." });
    }
  }

  /** Turns an access token into the user's profile. Provider specific. */
  abstract fetchProfile(tokens: TokenSet): Promise<OAuthProfile>;

  /** The URL to send the browser to. */
  buildAuthorizationUrl(params: AuthorizationParams): string {
    const query = new URLSearchParams({
      response_type: "code",
      client_id: this.options.clientId,
      redirect_uri: params.redirectUri,
      scope: (this.options.scopes ?? this.defaultScopes).join(this.scopeSeparator),
      state: params.state,
    });
    if (this.usesPkce && params.codeChallenge) {
      query.set("code_challenge", params.codeChallenge);
      query.set("code_challenge_method", "S256");
    }
    for (const [key, value] of Object.entries({ ...this.defaultAuthorizationParams, ...this.options.authorizationParams })) {
      if (!RESERVED.has(key)) query.set(key, value);
    }
    return `${this.authorizationEndpoint}?${query.toString()}`;
  }

  /** Swaps the one-time `code` for tokens (server-to-server, with the client secret). */
  async exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<TokenSet> {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
    });
    if (this.usesPkce && codeVerifier) form.set("code_verifier", codeVerifier);

    const res = await this.request(this.tokenEndpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const body = this.asRecord(res.body);
    const providerError = typeof body.error === "string" ? body.error : undefined;
    // Some providers (GitHub) answer 200 with an `error` field.
    if (!res.ok || providerError) {
      if (providerError && CODE_ERRORS.has(providerError)) {
        throw new BadRequestError({
          message: "The sign-in code is invalid or has expired. Please try again.",
          code: ErrorCode.OAUTH_CODE_INVALID,
        });
      }
      throw this.failure("token exchange", res.status, providerError);
    }
    if (typeof body.access_token !== "string" || !body.access_token) throw this.failure("token exchange", res.status, "missing_access_token");

    return {
      accessToken: body.access_token,
      tokenType: typeof body.token_type === "string" ? body.token_type : undefined,
      scope: typeof body.scope === "string" ? body.scope : undefined,
      idToken: typeof body.id_token === "string" ? body.id_token : undefined,
      raw: body,
    };
  }

  /** GET a JSON resource from the provider's API with the user's access token. */
  protected async getJson(url: string, tokens: TokenSet, headers: Record<string, string> = {}): Promise<ProviderResponse> {
    return this.request(url, { method: "GET", headers: { accept: "application/json", authorization: `Bearer ${tokens.accessToken}`, ...headers } });
  }

  protected async request(url: string, init: RequestInit): Promise<ProviderResponse> {
    const doFetch = this.options.fetch ?? fetch;
    let res: Response;
    try {
      // Never follow redirects with credentials attached.
      res = await doFetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000) });
    } catch (cause) {
      throw new BadGatewayError({
        message: `${this.displayName} could not be reached. Please try again.`,
        code: ErrorCode.OAUTH_PROVIDER_ERROR,
        details: { provider: this.name },
        cause,
      });
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    return { status: res.status, ok: res.ok, body };
  }

  /** A safe-to-show upstream failure: only the provider's short error *code* is exposed, never bodies or secrets. */
  protected failure(operation: string, status: number, providerError?: string): BadGatewayError {
    return new BadGatewayError({
      message: `${this.displayName} rejected the ${operation}.`,
      code: ErrorCode.OAUTH_PROVIDER_ERROR,
      details: { provider: this.name, operation, status, ...(providerError ? { providerError: providerError.slice(0, 64) } : {}) },
    });
  }

  protected asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}
