import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/providers/auth-provider";
import { LoginPage } from "@/pages/login-page";

describe("LoginPage", () => {
  it("renders sign in heading", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(view.getByText("Curolia")).toBeInTheDocument();
  });
});
