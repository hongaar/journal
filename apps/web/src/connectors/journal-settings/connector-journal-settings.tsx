import type { JournalConnector } from "@/types/database";
import { IcalConnectorJournalSettings } from "./ical-connector-journal-settings";

type Props = {
  connectorTypeId: string;
  journalId: string;
  jc: JournalConnector;
};

/**
 * Renders per-journal connector options. Add a branch per implemented connector.
 */
export function ConnectorJournalSettings({ connectorTypeId, journalId, jc }: Props) {
  switch (connectorTypeId) {
    case "ical":
      return <IcalConnectorJournalSettings journalId={journalId} jc={jc} />;
    default:
      return null;
  }
}
