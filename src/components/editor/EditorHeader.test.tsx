import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EditorHeader from "./EditorHeader";
import type { Tables } from "@/integrations/supabase/types";

type Page = Tables<"pages">;

describe("unified editor progress", () => {
  it("counts generated and approved audiobook content", () => {
    const page = {
      audiobook_text: "Texto de teste",
      audiobook_audio_url: "r2:11111111-1111-4111-8111-111111111111",
      audiobook_status: "approved",
      audiodesc_text: null,
      audiodesc_audio_url: null,
      audiodesc_status: "pending",
    } as Page;
    render(<MemoryRouter><EditorHeader projectName="Livro sintético" pages={[page]} saving={false} activeTab="unified" onNameChange={() => {}} /></MemoryRouter>);
    expect(screen.getByText("1 extraídas")).toBeInTheDocument();
    expect(screen.getByText("1 áudios")).toBeInTheDocument();
    expect(screen.getByText("1 aprovados")).toBeInTheDocument();
  });
});
