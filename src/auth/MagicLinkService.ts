import type { Request } from "express";
import type { ForgeConfig, ResolvedMagicLinkConfig } from "../config/ForgeConfig.js";
import { BadRequestError, ErrorCode } from "../errors/index.js";
import { MAGIC_LINK_MODEL } from "../data/internalModels.js";
import type { DataSource, Doc, Repository } from "../data/Repository.js";
import type { EmailService } from "../email/EmailService.js";
import { randomToken, safeEqual, sha256 } from "../security/TokenService.js";
import type { Logger } from "../utils/Logger.js";
import type { AccountLinkPolicy } from "./AccountLinkPolicy.js";
import type { LoginCompleter, LoginResult } from "./LoginCompleter.js";
import type { UserProvisioner } from "./UserProvisioner.js";

/**
 * Passwordless sign-in: an e-mailed, single-use link.
 *
 * Design choices that matter:
 * - Requesting a link *always* looks the same to the caller, so it cannot be used to find out which e-mails have accounts.
 * - The link opens a front-end page, which then `POST`s the token. Mail scanners follow links with GET; if a GET could
 *   sign someone in (or burn the token), scanners would break the feature and could even use the link.
 * - Only a hash of the token is stored; it is 256 bits of randomness, so it cannot be guessed.
 * - The link is bound to the browser that asked for it (cookie), so an attacker cannot mail *their own* link to a victim
 *   and silently sign them in to the attacker's account (login CSRF).
 * - Using it deletes it first: of two simultaneous attempts exactly one wins.
 */
export class MagicLinkService {
  constructor(
    private readonly config: ForgeConfig,
    private readonly data: DataSource,
    private readonly users: () => Repository,
    private readonly emails: EmailService,
    private readonly provisioner: UserProvisioner,
    private readonly linkPolicy: AccountLinkPolicy,
    private readonly completer: LoginCompleter,
    private readonly logger: Logger,
  ) {}

  private get settings(): ResolvedMagicLinkConfig {
    return this.config.auth.magicLink as ResolvedMagicLinkConfig;
  }

  private get links(): Repository {
    return this.data.repository(MAGIC_LINK_MODEL);
  }

  /**
   * Sends a link if the address may sign in. Never reveals whether it did: the caller should answer 200 either way,
   * and mail-provider failures are logged, not reported (a failure only for real accounts would reveal them).
   */
  async request(rawEmail: string, options: { name?: string | undefined; binding: string }): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const existing = await this.users().findOne({ [this.config.auth.fields.email]: email });
    if (!existing && !this.settings.allowSignup) return;

    const now = Date.now();
    const pending = await this.links.findOne({ email });
    if (pending) {
      const recent = new Date(pending.lastSentAt as string | Date).getTime() + this.settings.resendCooldown.toMs() > now;
      const alive = new Date(pending.expiresAt as string | Date).getTime() > now;
      if (recent && alive) return; // the link already in the inbox keeps working; do not flood the address
    }

    const token = randomToken(32);
    const record = {
      email,
      tokenHash: sha256(token),
      bindingHash: this.settings.sameDevice ? sha256(options.binding) : null,
      name: options.name?.trim() || null,
      expiresAt: this.settings.expiresIn.fromNow(now),
      lastSentAt: new Date(now),
    };
    try {
      if (pending) await this.links.updateById(pending._id, record);
      else await this.links.create(record);
    } catch (error) {
      // Two simultaneous requests for a new address: the other one stored its link; that is enough.
      this.logger.debug("Magic link was already created by a concurrent request.", { error: String(error) });
      return;
    }

    const url = new URL(this.settings.url);
    url.searchParams.set("token", token);
    if (this.config.isOffline) this.logger.info(`[offline] magic link for ${email}: ${url.toString()}`);

    try {
      await this.emails.sendTemplate({
        to: email,
        subject: "Your sign-in link",
        template: "magic-link",
        placeholders: {
          magicLinkUrl: url.toString(),
          expiryMinutes: Math.max(1, Math.round(this.settings.expiresIn.toMs() / 60_000)),
          userName: existing ? ((existing.name as string | undefined) ?? "there") : (options.name?.trim() || "there"),
          userEmail: email,
        },
      });
    } catch (error) {
      this.logger.error("Could not send a magic link.", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Redeems a link. Expired, used and unknown links are indistinguishable on purpose. */
  async verify(token: string, binding: string | undefined, req: Request): Promise<LoginResult> {
    const record = await this.links.findOne({ tokenHash: sha256(token) }, { withSecrets: ["tokenHash", "bindingHash"] });
    if (!record) throw this.invalid();
    if (new Date(record.expiresAt as string | Date).getTime() <= Date.now()) {
      await this.links.deleteById(record._id);
      throw this.invalid();
    }

    // Wrong browser: refuse, but do not burn the link - the rightful owner can still use it.
    if (this.settings.sameDevice) {
      const stored = record.bindingHash as string | null | undefined;
      if (!binding || !stored || !safeEqual(stored, sha256(binding))) {
        throw new BadRequestError({
          message: "Open the link in the same browser where you asked for it, or request a new one.",
          code: ErrorCode.MAGIC_LINK_DEVICE_MISMATCH,
        });
      }
    }

    const email = record.email as string;
    const existing = await this.users().findOne({ [this.config.auth.fields.email]: email });
    if (existing) this.linkPolicy.assertMayLink(this.settings.accountLinking, "magic links");

    // Single use: deleting is the claim. Whoever gets the document back wins.
    if (!(await this.links.deleteById(record._id))) throw this.invalid();

    const user = existing ?? (await this.provisioner.create({ email, name: record.name as string | undefined }));
    return this.completer.complete(user as Doc, req, { created: !existing });
  }

  private invalid(): BadRequestError {
    return new BadRequestError({ message: "This sign-in link is invalid or has expired.", code: ErrorCode.MAGIC_LINK_INVALID });
  }
}
