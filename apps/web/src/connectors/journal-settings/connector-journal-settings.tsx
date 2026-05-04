import type { JournalConnector } from "@/types/database";
import { IcalConnectorJournalSettings } from "./ical-connector-journal-settings";

type Props = {
  connectorTypeId: string;
  journalId: string;
  jc: JournalConnector;
  readOnly?: boolean;
};

/**
 * Renders per-journal connector options. Add a branch per implemented connector.
 */
export function ConnectorJournalSettings({ connectorTypeId, journalId, jc, readOnly = false }: Props) {
  switch (connectorTypeId) {
    case "ical":
      return <IcalConnectorJournalSettings journalId={journalId} jc={jc} readOnly={readOnly} />;
    default:
      return null;
  }
}
