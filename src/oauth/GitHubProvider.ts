import { OAuthProvider, type OAuthProfile, type TokenSet } from "./OAuthProvider.js";

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

const API_HEADERS = { "user-agent": "forge-oauth", "x-github-api-version": "2022-11-28", accept: "application/vnd.github+json" };

/**
 * "Sign in with GitHub".
 * Register an OAuth App at https://github.com/settings/developers with
 * `<backendURL>/auth/oauth/github/callback` as the callback URL.
 *
 * A GitHub account can hide its e-mail, so the user's e-mail list is read
 * (scope `user:email`) and only a *verified* address is trusted.
 */
export class GitHubProvider extends OAuthProvider {
  readonly name: string = "github";
  readonly displayName = "GitHub";
  protected readonly authorizationEndpoint = "https://github.com/login/oauth/authorize";
  protected readonly tokenEndpoint = "https://github.com/login/oauth/access_token";
  protected readonly defaultScopes = ["read:user", "user:email"] as const;
  private readonly apiBase = "https://api.github.com";

  async fetchProfile(tokens: TokenSet): Promise<OAuthProfile> {
    const [userRes, emailsRes] = await Promise.all([
      this.getJson(`${this.apiBase}/user`, tokens, API_HEADERS),
      this.getJson(`${this.apiBase}/user/emails`, tokens, API_HEADERS),
    ]);

    const user = this.asRecord(userRes.body);
    if (!userRes.ok || (typeof user.id !== "number" && typeof user.id !== "string")) throw this.failure("profile request", userRes.status);

    const emails = (emailsRes.ok && Array.isArray(emailsRes.body) ? emailsRes.body : []).filter(
      (e): e is GitHubEmail => typeof e === "object" && e !== null && typeof (e as GitHubEmail).email === "string",
    );
    const verified = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
    const fallback = emails.find((e) => e.primary) ?? emails[0];

    return {
      providerUserId: String(user.id),
      email: verified?.email ?? fallback?.email ?? (typeof user.email === "string" ? user.email : undefined),
      emailVerified: Boolean(verified),
      name: typeof user.name === "string" && user.name ? user.name : typeof user.login === "string" ? user.login : undefined,
      avatarUrl: typeof user.avatar_url === "string" ? user.avatar_url : undefined,
    };
  }
}
