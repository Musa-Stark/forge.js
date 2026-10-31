import type { Request } from "express";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import { BadRequestError, ErrorCode, ForbiddenError, UnauthorizedError } from "../errors/index.js";
import type { AccountLinkPolicy } from "../auth/AccountLinkPolicy.js";
import type { SessionService, SessionTokens } from "../auth/SessionService.js";
import type { UserProvisioner } from "../auth/UserProvisioner.js";
import { OAUTH_IDENTITY_MODEL } from "../data/internalModels.js";
import type { DataSource, Doc, Repository } from "../data/Repository.js";
import { randomToken, safeEqual, type TokenService } from "../security/TokenService.js";
import type { Logger } from "../utils/Logger.js";
import type { OAuthProfile } from "./OAuthProvider.js";
import type { OAuthProviderRegistry } from "./OAuthProviderRegistry.js";
import { pkce } from "./pkce.js";

export interface BeginResult {
  /** Send the browser here. */
  url: string;
  /** Signed envelope to keep in a cookie until the provider sends the browser back. */
  stateToken: string;
}

export interface CompleteInput {
  provider: string;
  /** Everything below comes straight from the callback request and is untrusted. */
  code: unknown;
  state: unknown;
  error: unknown;
  stateToken: string | undefined;
  redirectUri: string;
}

export interface OAuthOutcome {
  user: Doc;
  tokens: SessionTokens;
  created: boolean;
  provider: string;
  returnTo: string | undefined;
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * The "Sign in with ..." use cases, independent of HTTP and of any one provider.
 *
 * Security properties:
 * - CSRF: a random `state` is bound to the browser by a signed cookie and compared in constant time.
 * - Code interception: PKCE (S256) on providers that support it.
 * - Account takeover: only a *provider-verified* e-mail is accepted, and linking to an existing local
 *   account follows `accountLinking` (see {@link OAuthService.assertMayLink}).
 * - The provider's stable user id - not the e-mail - identifies a returning user.
 */
export class OAuthService {
  constructor(
    private readonly config: ForgeConfig,
    private readonly data: DataSource,
    private readonly userModel: string,
    private readonly provisioner: UserProvisioner,
    private readonly linkPolicy: AccountLinkPolicy,
    private readonly registry: OAuthProviderRegistry,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly logger: Logger,
  ) {}

  private get users(): Repository {
    return this.data.repository(this.userModel);
  }

  private get identities(): Repository {
    return this.data.repository(OAUTH_IDENTITY_MODEL);
  }

  private get oauthConfig() {
    return this.config.auth.oauth;
  }

  begin(providerName: string, redirectUri: string, returnTo?: string): BeginResult {
    const provider = this.registry.get(providerName);
    const state = randomToken(24);
    const verifier = provider.usesPkce ? pkce.generateVerifier() : undefined;

    const url = provider.buildAuthorizationUrl({
      state,
      redirectUri,
      codeChallenge: verifier ? pkce.challengeFor(verifier) : undefined,
    });
    const stateToken = this.tokens.signOAuthState(
      { prv: provider.name, st: state, ...(verifier ? { cv: verifier } : {}), ...(returnTo ? { rt: returnTo } : {}) },
      this.oauthConfig!.stateAge,
    );
    return { url, stateToken };
  }

  async complete(input: CompleteInput, req: Request): Promise<OAuthOutcome> {
    const provider = this.registry.get(input.provider);

    // 1. Is this callback the continuation of a flow *this browser* started?
    const claims = this.tokens.verifyOAuthState(input.stateToken);
    if (claims.prv !== provider.name || typeof input.state !== "string" || !safeEqual(claims.st, input.state)) {
      throw new BadRequestError({
        message: "The sign-in session does not match. Please start again.",
        code: ErrorCode.OAUTH_STATE_INVALID,
      });
    }

    // 2. The user may have pressed "Cancel" at the provider.
    if (typeof input.error === "string" && input.error) {
      throw new UnauthorizedError({ message: "Sign-in was cancelled or denied.", code: ErrorCode.OAUTH_ACCESS_DENIED });
    }
    if (typeof input.code !== "string" || input.code.length === 0 || input.code.length > 2048) {
      throw new BadRequestError({ message: "The sign-in code is missing.", code: ErrorCode.OAUTH_CODE_INVALID });
    }

    // 3. Back-channel: code -> access token -> profile.
    const tokens = await provider.exchangeCode(input.code, input.redirectUri, claims.cv);
    const profile = await provider.fetchProfile(tokens);
    const email = this.verifiedEmail(provider.displayName, profile);

    // 4. Find or create the local user.
    const { user, created } = await this.resolveUser(provider.name, profile, email);

    return {
      user,
      created,
      provider: provider.name,
      returnTo: claims.rt,
      tokens: await this.sessions.start(user._id, req),
    };
  }

  private verifiedEmail(providerName: string, profile: OAuthProfile): string {
    const email = profile.email?.trim().toLowerCase();
    if (!email || !EMAIL.test(email)) {
      throw new BadRequestError({
        message: `${providerName} did not share an e-mail address.`,
        code: ErrorCode.OAUTH_EMAIL_MISSING,
        hint: "Ask for the 'email' scope, and make sure the account has an e-mail address.",
      });
    }
    if (!profile.emailVerified) {
      throw new ForbiddenError({
        message: `Your ${providerName} e-mail address is not verified. Verify it there and try again.`,
        code: ErrorCode.OAUTH_EMAIL_UNVERIFIED,
      });
    }
    return email;
  }

  private async resolveUser(provider: string, profile: OAuthProfile, email: string): Promise<{ user: Doc; created: boolean }> {
    const identity = await this.identities.findOne({ provider, providerUserId: profile.providerUserId });

    if (identity) {
      const user = await this.users.findById(String(identity.owner));
      if (user) {
        await this.identities.updateById(identity._id, { lastLoginAt: new Date(), email });
        return { user, created: false };
      }
      // The local account was deleted: forget the dangling link and start fresh.
      await this.identities.deleteById(identity._id);
    }

    const existing = await this.users.findOne({ [this.config.auth.fields.email]: email });
    if (existing) {
      this.linkPolicy.assertMayLink(this.oauthConfig!.accountLinking, "OAuth sign-in");
      await this.link(existing._id, provider, profile, email);
      return { user: existing, created: false };
    }

    const user = await this.provisioner.create({ email, name: profile.name, extra: this.oauthConfig!.userFromProfile?.(profile) });
    await this.link(user._id, provider, profile, email);
    return { user, created: true };
  }

  private async link(userId: string, provider: string, profile: OAuthProfile, email: string): Promise<void> {
    await this.identities.create({ owner: userId, provider, providerUserId: profile.providerUserId, email, lastLoginAt: new Date() });
    this.logger.debug("Linked a social identity.", { provider, userId });
  }
}
