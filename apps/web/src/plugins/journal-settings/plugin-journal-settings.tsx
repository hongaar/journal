import type { JournalPlugin } from "@/types/database";
import { IcalPluginJournalSettings } from "./ical-plugin-journal-settings";

type Props = {
  pluginTypeId: string;
  journalId: string;
  /** Per-journal row; created on first save when missing. */
  jp: JournalPlugin | undefined;
  /** Whether this plugin is enabled for your account (Plugins in the user menu). */
  pluginGloballyEnabled: boolean;
  readOnly?: boolean;
};

/**
 * Renders per-journal plugin options. Add a branch per implemented plugin.
 */
export function PluginJournalSettings({
  pluginTypeId,
  journalId,
  jp,
  pluginGloballyEnabled,
  readOnly = false,
}: Props) {
  switch (pluginTypeId) {
    case "ical":
      return (
        <IcalPluginJournalSettings
          journalId={journalId}
          jp={jp}
          pluginGloballyEnabled={pluginGloballyEnabled}
          readOnly={readOnly}
        />
      );
    default:
      return null;
  }
}
