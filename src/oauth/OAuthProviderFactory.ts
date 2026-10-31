import { ConfigurationError } from "../errors/index.js";
import { GitHubProvider } from "./GitHubProvider.js";
import { GoogleProvider } from "./GoogleProvider.js";
import { OAuthProvider, type OAuthClientOptions } from "./OAuthProvider.js";
import { OAuthProviderRegistry } from "./OAuthProviderRegistry.js";

export type BuiltInOAuthProvider = "google" | "github";

/** `{ provider: "google", clientId, clientSecret }` - the shorthand for the built-in providers. */
export interface OAuthProviderConfig extends OAuthClientOptions {
  provider: BuiltInOAuthProvider;
}

/** Either the shorthand config, or a ready-made provider instance (your own subclass). */
export type OAuthProviderEntry = OAuthProviderConfig | OAuthProvider;

type ProviderClass = new (options: OAuthClientOptions) => OAuthProvider;

/** Builds provider instances from configuration. */
export class OAuthProviderFactory {
  private static readonly builtIn: ReadonlyMap<string, ProviderClass> = new Map<string, ProviderClass>([
    ["google", GoogleProvider],
    ["github", GitHubProvider],
  ]);

  static nameOf(entry: OAuthProviderEntry): string {
    return entry instanceof OAuthProvider ? entry.name : entry.provider;
  }

  create(entry: OAuthProviderEntry, defaults: { fetch?: typeof fetch } = {}): OAuthProvider {
    if (entry instanceof OAuthProvider) return entry;

    const { provider, ...options } = entry;
    const Type = OAuthProviderFactory.builtIn.get(provider);
    if (!Type) {
      throw new ConfigurationError({
        message: `Unknown OAuth provider '${String(provider)}'.`,
        hint: `Built-in providers: ${[...OAuthProviderFactory.builtIn.keys()].join(", ")}. For any other provider, pass an instance of your own OAuthProvider subclass.`,
      });
    }
    return new Type({ ...(defaults.fetch ? { fetch: defaults.fetch } : {}), ...options });
  }

  createRegistry(entries: readonly OAuthProviderEntry[], defaults: { fetch?: typeof fetch } = {}): OAuthProviderRegistry {
    const registry = new OAuthProviderRegistry();
    for (const entry of entries) registry.register(this.create(entry, defaults));
    return registry;
  }
}
