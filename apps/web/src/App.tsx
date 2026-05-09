import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { ProtectedLayout } from "@/routes/protected-layout";
import { LoginPage } from "@/pages/login-page";
import { MapPage } from "@/pages/map-page";
import { BlogPage } from "@/pages/blog-page";
import { TraceDetailPage } from "@/pages/trace-detail-page";
import { PluginsPage } from "@/pages/plugins-page";
import { ProfilePage } from "@/pages/profile-page";
import { AppSettingsPage } from "@/pages/app-settings-page";
import { JournalSettingsPage } from "@/pages/journal-settings-page";
import { InvitationsPage } from "@/pages/invitations-page";
import { NotificationsPage } from "@/pages/notifications-page";
import {
  BlogHomeRedirectPage,
  HomeRedirectPage,
} from "@/pages/home-redirect-page";
import { TraceLegacyRedirectPage } from "@/pages/trace-legacy-redirect-page";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route element={<AppShell />}>
          <Route index element={<HomeRedirectPage />} />
          <Route path="map/:journalSlug" element={<MapPage />} />
          <Route path="blog" element={<BlogHomeRedirectPage />} />
          <Route path="blog/:journalSlug" element={<BlogPage />} />
          <Route
            path="traces/:journalSlug/:traceSlug"
            element={<TraceDetailPage />}
          />
          <Route
            path="traces/:legacyTraceId"
            element={<TraceLegacyRedirectPage />}
          />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<AppSettingsPage />} />
          <Route path="settings/plugins" element={<PluginsPage />} />
          <Route
            path="settings/connectors"
            element={<Navigate to="/settings/plugins" replace />}
          />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="invitations" element={<InvitationsPage />} />
          <Route
            path="journals/:journalId/settings"
            element={<JournalSettingsPage />}
          />
        </Route>
      </Route>
    </Routes>
  );
}
