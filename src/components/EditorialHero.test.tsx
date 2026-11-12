import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditorialHero from "./EditorialHero";

describe("EditorialHero", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
  const mount = () => render(<MemoryRouter><EditorialHero /></MemoryRouter>);

  it("starts with the original children's video and a local poster", () => {
    const { container } = mount();
    expect(screen.getByRole("button", { name: "Infantil" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("video")).toHaveAttribute("src", "/videos/hero-bg.mp4");
    expect(container.querySelector("video")).toHaveAttribute("poster", "/images/infantil-poster.jpg");
  });
  it("rotates through all three audiences and wraps after eight seconds each", () => {
    mount();
    for (const name of ["Literário", "Educacional", "Infantil"]) {
      act(() => vi.advanceTimersByTime(8000));
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    }
  });
  it("manual navigation pauses rotation and can resume", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Educacional" }));
    act(() => vi.advanceTimersByTime(24000));
    expect(screen.getByRole("button", { name: "Educacional" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Retomar apresentação automática" }));
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("button", { name: "Infantil" })).toHaveAttribute("aria-pressed", "true");
  });
  it("pauses when keyboard focus enters and when pointer hovers", () => {
    mount();
    const region = screen.getByRole("region");
    fireEvent.mouseEnter(region);
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("button", { name: "Infantil" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.mouseLeave(region);
    fireEvent.focus(screen.getByRole("link", { name: /Criar primeiro/ }));
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("button", { name: "Retomar apresentação automática" })).toBeInTheDocument();
  });
  it("does not autoplay or rotate with reduced motion", () => {
    const original = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...original(query), matches: true }));
    mount();
    act(() => vi.advanceTimersByTime(24000));
    expect(screen.getByRole("button", { name: "Infantil" })).toHaveAttribute("aria-pressed", "true");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Retomar apresentação automática" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima variação" }));
    expect(screen.getByRole("button", { name: "Literário" })).toHaveAttribute("aria-pressed", "true");
  });
  it("keeps the image visible if video playback fails", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error("blocked"));
    const { container } = mount();
    await act(async () => {});
    expect(container.querySelector(".editorial-image.is-active")).toHaveAttribute("src", "/images/infantil-poster.jpg");
    expect(container.querySelector("video")).not.toHaveClass("is-active");
  });
});
