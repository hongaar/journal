import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { ProtectedLayout } from "@/routes/protected-layout";
import { LoginPage } from "@/pages/login-page";
import { MapPage } from "@/pages/map-page";
import { BlogPage } from "@/pages/blog-page";
import { TraceDetailPage } from "@/pages/trace-detail-page";
import { ConnectorsPage } from "@/pages/connectors-page";
import { ProfilePage } from "@/pages/profile-page";
import { AppSettingsPage } from "@/pages/app-settings-page";
import { JournalSettingsPage } from "@/pages/journal-settings-page";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route element={<AppShell />}>
          <Route index element={<MapPage />} />
          <Route path="blog" element={<BlogPage />} />
          <Route path="traces/:traceId" element={<TraceDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<AppSettingsPage />} />
          <Route path="settings/connectors" element={<ConnectorsPage />} />
          <Route path="journals/:journalId/settings" element={<JournalSettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
