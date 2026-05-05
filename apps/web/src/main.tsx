import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/providers/auth-provider";
import { Toaster } from "@curolia/ui/sonner";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
