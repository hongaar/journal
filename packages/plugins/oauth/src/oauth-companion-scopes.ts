/**
 * Extra scopes merged into the OAuth authorize URL after each plugin's own
 * scopes from `pluginManifest.contributions.oauth` (see `extract-plugin-oauth-registry.ts`).
 *
 * Keys are Curolia OAuth **provider ids** (same strings as `contributions.oauth[].provider`).
 */
export const OAUTH_COMPANION_SCOPES_BY_PROVIDER: Readonly<
  Record<string, readonly string[]>
> = {
  google: ["openid", "email", "profile"],
};
