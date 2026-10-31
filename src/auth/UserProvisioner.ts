import type { ForgeConfig } from "../config/ForgeConfig.js";
import type { Doc, Repository } from "../data/Repository.js";
import type { PasswordHasher } from "../security/PasswordHasher.js";
import { randomToken } from "../security/TokenService.js";

export interface NewUserInput {
  email: string;
  /** Display name, used when the user schema has a `name` field. Defaults to the e-mail's local part. */
  name?: string | undefined;
  /** Additional schema fields (e.g. from `oauth.userFromProfile`). Never allowed to change the e-mail or password. */
  extra?: Record<string, unknown> | undefined;
}

/**
 * Creates accounts for people who arrive without choosing a password (OAuth, magic link).
 *
 * The schema still requires a password, so a random, never-disclosed one is stored: it cannot be guessed,
 * and the user can set a real one any time through "forgot password".
 */
export class UserProvisioner {
  constructor(
    private readonly config: ForgeConfig,
    private readonly users: () => Repository,
    private readonly hasher: PasswordHasher,
    private readonly knownFields: ReadonlySet<string>,
  ) {}

  async create(input: NewUserInput): Promise<Doc> {
    const { fields } = this.config.auth;
    const name = input.name?.trim() || input.email.split("@")[0];
    return this.users().create({
      ...(this.knownFields.has("name") ? { name } : {}),
      ...input.extra,
      [fields.email]: input.email,
      [fields.password]: await this.hasher.hash(randomToken(32)),
    });
  }
}
