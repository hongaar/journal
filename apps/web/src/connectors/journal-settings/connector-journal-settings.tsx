import type { JournalConnector } from "@/types/database";
import { IcalConnectorJournalSettings } from "./ical-connector-journal-settings";

type Props = {
  connectorTypeId: string;
  journalId: string;
  /** Per-journal row; created on first save when missing. */
  jc: JournalConnector | undefined;
  /** Whether this connector is enabled for your account (Connectors in the user menu). */
  connectorGloballyEnabled: boolean;
  readOnly?: boolean;
};

/**
 * Renders per-journal connector options. Add a branch per implemented connector.
 */
export function ConnectorJournalSettings({
  connectorTypeId,
  journalId,
  jc,
  connectorGloballyEnabled,
  readOnly = false,
}: Props) {
  switch (connectorTypeId) {
    case "ical":
      return (
        <IcalConnectorJournalSettings
          journalId={journalId}
          jc={jc}
          connectorGloballyEnabled={connectorGloballyEnabled}
          readOnly={readOnly}
        />
      );
    default:
      return null;
  }
}
