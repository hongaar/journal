import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComponentType } from "react";

/**
 * Shell-provided snapshot of `user_plugins` for account-level plugin UI.
 */
export type PluginUserPluginSnapshot = {
  enabled: boolean;
  status: string;
  config: unknown;
};

/** Result of Edge `plugin-oauth` `link_status` action (also derivable from config). */
export type PluginOAuthLinkStatusResult = {
  linked: boolean;
  email: string | null;
  /** Google subject identifier when email is unavailable (legacy links). */
  sub: string | null;
  status: string | null;
};

/**
 * Bound OAuth helpers from the app shell (calls Edge `plugin-oauth`).
 * Present when the shell wires plugin OAuth for this panel (e.g. Google Photos).
 */
export type PluginOAuthShellHandlers = {
  fetchLinkStatus: () => Promise<PluginOAuthLinkStatusResult>;
  unlink: () => Promise<void>;
  startOAuth: (redirectAfter: string) => Promise<void>;
};

/**
 * Props for optional account settings panels (link OAuth, plugin-specific options).
 * Implemented in plugin packages; shell passes session-backed data.
 */
export type PluginAccountPanelProps = {
  pluginTypeId: string;
  pluginEnabled: boolean;
  userPlugin: PluginUserPluginSnapshot | undefined;
  accessToken: string | null;
  onRefresh: () => Promise<void>;
  oauth?: PluginOAuthShellHandlers;
  /**
   * Optional: panels that update `user_plugins` or other tables from the client
   * (e.g. API keys / usernames). The web shell provides these when supported.
   */
  supabase?: SupabaseClient;
  userId?: string | null;
};

export type PluginAccountSettingsComponent =
  ComponentType<PluginAccountPanelProps>;
