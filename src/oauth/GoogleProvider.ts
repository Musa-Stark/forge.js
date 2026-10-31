import { OAuthProvider, type OAuthProfile, type TokenSet } from "./OAuthProvider.js";

/**
 * "Sign in with Google" (OpenID Connect).
 * Create credentials at https://console.cloud.google.com/apis/credentials and add
 * `<backendURL>/auth/oauth/google/callback` as an authorised redirect URI.
 */
export class GoogleProvider extends OAuthProvider {
  readonly name: string = "google";
  readonly displayName = "Google";
  protected readonly authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
  protected readonly tokenEndpoint = "https://oauth2.googleapis.com/token";
  protected readonly defaultScopes = ["openid", "email", "profile"] as const;
  private readonly userInfoEndpoint = "https://openidconnect.googleapis.com/v1/userinfo";

  async fetchProfile(tokens: TokenSet): Promise<OAuthProfile> {
    const res = await this.getJson(this.userInfoEndpoint, tokens);
    const info = this.asRecord(res.body);
    if (!res.ok || typeof info.sub !== "string" || !info.sub) throw this.failure("profile request", res.status);

    return {
      providerUserId: info.sub,
      email: typeof info.email === "string" ? info.email : undefined,
      // Google reports a boolean, but older responses used the string "true".
      emailVerified: info.email_verified === true || info.email_verified === "true",
      name: typeof info.name === "string" ? info.name : undefined,
      avatarUrl: typeof info.picture === "string" ? info.picture : undefined,
    };
  }
}
