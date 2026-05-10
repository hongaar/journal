import type { PluginCapability } from "./capabilities";
import type { PluginContributions } from "./contributions";
import type { PluginAccountSettingsComponent } from "./account-panel";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComponentType } from "react";

/** Props for optional trace editor UI next to native photo upload (cloud library importers). */
export type TracePhotoImportSlotProps = {
  supabase: SupabaseClient;
  /** Current signed-in user id (shell reads from auth); omit when logged out. */
  userId?: string | null;
  traceId: string;
  journalId: string;
  traceDate?: string | null;
  traceEndDate?: string | null;
};

export type PluginIconComponent = ComponentType<{ className?: string }>;

export type PluginDefinition = {
  id: string;
  displayName: string;
  description?: string;
  /** UI icon component provided by plugin package. */
  icon: PluginIconComponent;
  capabilities: readonly PluginCapability[];
  /** When false, UI shows that sync is not implemented yet */
  implemented: boolean;
  /** Optional metadata for settings UI, hooks registry, and Edge deploy lists */
  contributions?: PluginContributions;
  /**
   * Account-wide configuration rendered below the title/description + enabled toggle
   * (OAuth linking, API keys, etc.).
   */
  AccountSettingsPanel?: PluginAccountSettingsComponent;
  /**
   * Rendered inline next to “Upload photos” in the trace editor when the plugin can import
   * library media for an existing trace.
   */
  TracePhotoImportSlot?: ComponentType<TracePhotoImportSlotProps>;
};

export type PluginRegistry = Record<string, PluginDefinition>;

export type PluginPackageManifest = PluginDefinition;
