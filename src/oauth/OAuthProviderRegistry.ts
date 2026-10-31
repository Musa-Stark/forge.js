import { ConfigurationError, ErrorCode, NotFoundError } from "../errors/index.js";
import type { OAuthProvider } from "./OAuthProvider.js";

const NAME = /^[a-z][a-z0-9-]{1,30}$/;
/** Used by the `/oauth/providers` route: a provider with this name would shadow it. */
const RESERVED = new Set(["providers"]);

/** The sign-in providers enabled for this app. Add one at any time before the app is built. */
export class OAuthProviderRegistry {
  private readonly providers = new Map<string, OAuthProvider>();

  register(provider: OAuthProvider): this {
    if (!NAME.test(provider.name) || RESERVED.has(provider.name)) {
      throw new ConfigurationError({
        message: `Invalid OAuth provider name '${provider.name}'.`,
        hint: "Use 2-31 lowercase letters, digits or dashes, starting with a letter (and not 'providers').",
      });
    }
    if (this.providers.has(provider.name)) {
      throw new ConfigurationError({ message: `The OAuth provider '${provider.name}' is registered twice.` });
    }
    this.providers.set(provider.name, provider);
    return this;
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  get(name: string): OAuthProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new NotFoundError({
        message: `Sign-in with '${name.slice(0, 40)}' is not available.`,
        code: ErrorCode.OAUTH_PROVIDER_NOT_FOUND,
      });
    }
    return provider;
  }

  list(): OAuthProvider[] {
    return [...this.providers.values()];
  }

  get size(): number {
    return this.providers.size;
  }
}
