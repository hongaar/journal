import type { JournalMemberRole } from "@/types/database";

export function journalRoleLabel(role: JournalMemberRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "editor":
      return "Contributor";
    case "viewer":
      return "Reader";
    default:
      return role;
  }
}

export type InviteJournalRole = "viewer" | "editor";
