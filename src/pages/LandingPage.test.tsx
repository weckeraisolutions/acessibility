import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./LandingPage";
vi.mock("@djpfs/react-vlibras", () => ({ default: () => null }));
vi.mock("@/components/SEO", () => ({ default: () => null }));

describe("landing navigation", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("all section links point to real sections and signup CTAs target registration", () => {
    const { container } = render(<MemoryRouter><LandingPage /></MemoryRouter>);
    container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link => {
      expect(container.querySelector(link.hash)).not.toBeNull();
    });
    expect(screen.getByRole("link", { name: "Criar primeiro projeto" })).toHaveAttribute("href", "/auth?mode=signup");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelectorAll("details")).toHaveLength(6);
  });
  it("mobile menu closes with Escape and restores focus", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(screen.getByRole("navigation", { name: "Navegação móvel" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Fechar menu" }), { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Navegação móvel" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveFocus();
  });
  it("does not claim background processing, certification or fake popularity", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.queryByText("Mais escolhido")).not.toBeInTheDocument();
    expect(screen.queryByText("Processo retomável")).not.toBeInTheDocument();
    expect(screen.getByText(/Contratação e pagamento não estão disponíveis/)).toBeInTheDocument();
  });
});
