import type { Services } from "../core/Services.js";
import { ConfigurationError } from "../errors/index.js";
import { OAuthService } from "../oauth/OAuthService.js";
import { AccountLinkPolicy } from "./AccountLinkPolicy.js";
import { AuthService } from "./AuthService.js";
import { LoginCompleter } from "./LoginCompleter.js";
import { MagicLinkService } from "./MagicLinkService.js";
import { MfaService } from "./MfaService.js";
import { OtpService } from "./OtpService.js";
import { UserProvisioner } from "./UserProvisioner.js";
import type { Repository } from "../data/Repository.js";

/**
 * The auth object graph. Each service is built the first time it is needed (so features that are
 * not configured cost nothing) and then shared. To add a sign-in method: write its service, add one
 * lazy getter here, and end its flow in {@link LoginCompleter}.
 */
export class AuthServices {
  private _linkPolicy: AccountLinkPolicy | undefined;
  private _provisioner: UserProvisioner | undefined;
  private _mfa: MfaService | undefined;
  private _completer: LoginCompleter | undefined;
  private _otp: OtpService | undefined;
  private _auth: AuthService | undefined;
  private _oauth: OAuthService | undefined;
  private _magicLink: MagicLinkService | undefined;

  constructor(
    private readonly s: Services,
    /** Fields of the user schema (read when first needed, after the collection was prepared). */
    private readonly userFields: () => ReadonlySet<string>,
  ) {}

  private get userModel(): string {
    if (!this.s.userModel) throw new ConfigurationError({ message: "Authentication needs a user model." });
    return this.s.userModel;
  }

  private users = (): Repository => this.s.data.repository(this.userModel);

  get linkPolicy(): AccountLinkPolicy {
    return (this._linkPolicy ??= new AccountLinkPolicy(this.s.config));
  }

  get provisioner(): UserProvisioner {
    return (this._provisioner ??= new UserProvisioner(this.s.config, this.users, this.s.hasher, this.userFields()));
  }

  /** `undefined` when `auth.mfa` is not configured. */
  get mfa(): MfaService | undefined {
    if (!this.s.config.auth.mfa) return undefined;
    return (this._mfa ??= new MfaService(this.s.config, this.s.data, this.s.vault, this.s.tokens));
  }

  requireMfa(): MfaService {
    const mfa = this.mfa;
    if (!mfa) throw new ConfigurationError({ message: "Two-factor authentication is not configured.", hint: "Add auth.mfa to builtinConfig." });
    return mfa;
  }

  get completer(): LoginCompleter {
    return (this._completer ??= new LoginCompleter(this.s.config, this.s.sessions, this.s.tokens, () => this.mfa));
  }

  get otp(): OtpService {
    return (this._otp ??= new OtpService(this.s.config, this.s.data, this.s.emails, this.s.logger));
  }

  get auth(): AuthService {
    return (this._auth ??= new AuthService(this.s.config, this.s.data, this.userModel, this.s.hasher, this.s.sessions, this.otp, this.completer));
  }

  get oauth(): OAuthService {
    if (!this.s.config.auth.oauth) {
      throw new ConfigurationError({ message: "Social sign-in is not configured.", hint: "Add auth.oauth to builtinConfig." });
    }
    return (this._oauth ??= new OAuthService(
      this.s.config, this.s.data, this.userModel, this.provisioner, this.linkPolicy, this.s.oauth, this.s.tokens, this.s.sessions, this.s.logger,
    ));
  }

  get magicLink(): MagicLinkService {
    if (!this.s.config.auth.magicLink) {
      throw new ConfigurationError({ message: "Magic links are not configured.", hint: "Add auth.magicLink to builtinConfig." });
    }
    return (this._magicLink ??= new MagicLinkService(
      this.s.config, this.s.data, this.users, this.s.emails, this.provisioner, this.linkPolicy, this.completer, this.s.logger,
    ));
  }
}
