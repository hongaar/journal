import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { ProtectedLayout } from "@/routes/protected-layout";
import { LoginPage } from "@/pages/login-page";
import { MapPage } from "@/pages/map-page";
import { TraceDetailPage } from "@/pages/trace-detail-page";
import { ConnectorsPage } from "@/pages/connectors-page";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route element={<AppShell />}>
          <Route index element={<MapPage />} />
          <Route path="traces/:traceId" element={<TraceDetailPage />} />
          <Route path="settings/connectors" element={<ConnectorsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
