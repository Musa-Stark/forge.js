import type { ForgeConfig } from "../config/ForgeConfig.js";
import type { AccountLinking } from "../config/ForgeOptions.js";
import { ConflictError, ErrorCode } from "../errors/index.js";

/**
 * May a sign-in that proves ownership of an e-mail address (an OAuth provider, a magic link) log in to an
 * account that already exists under that address? One rule, shared by every such method.
 *
 * It matters because of *account pre-hijacking*: if the existing account was created by someone else with a
 * password and no e-mail check, an attacker can register `victim@x.com` first, wait for the victim to sign
 * in the "safe" way, and keep their own password for the shared account.
 */
export class AccountLinkPolicy {
  constructor(private readonly config: ForgeConfig) {}

  isAllowed(policy: AccountLinking): boolean {
    return policy === "always" || (policy === "auto" && this.config.auth.signupMode === "otp");
  }

  assertMayLink(policy: AccountLinking, via: string): void {
    if (this.isAllowed(policy)) return;
    throw new ConflictError({
      message: "An account with this e-mail already exists. Please sign in with your e-mail and password.",
      code: ErrorCode.ACCOUNT_LINK_BLOCKED,
      hint:
        policy === "never"
          ? `accountLinking is 'never' for ${via}.`
          : "Accounts are linked automatically only when sign-up verifies e-mail addresses (auth.signupMode: 'otp'). Set accountLinking: 'always' to link anyway.",
    });
  }
}
