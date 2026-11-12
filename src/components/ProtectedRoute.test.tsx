import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { beforeEach, describe, it, expect, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";
import { SESSION_EXPIRED_EVENT } from "@/lib/storage";
const { auth } = vi.hoisted(() => ({ auth: { session: null as unknown, loading: false } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
function Location() { const location = useLocation(); return <p>{location.pathname + location.search}</p>; }
function mount() {
  return render(<MemoryRouter initialEntries={["/projeto/123"]}><Routes>
    <Route path="/projeto/:id" element={<ProtectedRoute><h1>Projeto privado</h1></ProtectedRoute>} />
    <Route path="/auth" element={<Location />} />
  </Routes></MemoryRouter>);
}
beforeEach(() => { auth.loading = false; auth.session = null; });
describe("session states", () => {
  it("preserves destination when login is required", () => {
    mount();
    expect(screen.getByText("/auth?next=%2Fprojeto%2F123")).toBeInTheDocument();
  });
  it("announces loading without exposing children", () => {
    auth.loading = true; mount();
    expect(screen.getByRole("status", { name: "Verificando sessão" })).toBeInTheDocument();
    expect(screen.queryByText("Projeto privado")).not.toBeInTheDocument();
  });
  it("hides protected content on an expired-session response", () => {
    auth.session = { user: { id: "test" } }; mount();
    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    expect(screen.getByRole("alert")).toHaveTextContent("Sua sessão expirou");
    expect(screen.queryByText("Projeto privado")).not.toBeInTheDocument();
  });
});
