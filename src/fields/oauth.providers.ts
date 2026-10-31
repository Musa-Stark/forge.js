export const OAUTH_PROVIDERS = [
  "local",
  "google",
  "github",
  "facebook",
  "apple",
  "microsoft",
  "discord",
  "linkedin",
  "x", // formerly Twitter
  "gitlab",
  "spotify",
  "twitch",
  "slack",
  "amazon",
  "dropbox",
] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
