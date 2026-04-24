// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// Use mupdf-wasm in Deno — supports rendering PDFs to PNG without node-canvas
import * as mupdf from "https://esm.sh/mupdf@1.3.0?bundle";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { project_id, chapter_id } = body;
    if (!project_id || !chapter_id) {
      return new Response(JSON.stringify({ error: "project_id and chapter_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify ownership and load chapter + project
    const { data: project } = await admin.from("projects").select("id, user_id, pdf_url").eq("id", project_id).single();
    if (!project || project.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!project.pdf_url) {
      return new Response(JSON.stringify({ error: "PDF source not found for this project" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: chapter } = await admin.from("chapters").select("*").eq("id", chapter_id).single();
    if (!chapter || chapter.project_id !== project_id) {
      return new Response(JSON.stringify({ error: "Chapter not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Download PDF (pdf_url may be storage path or full URL)
    let pdfBytes: Uint8Array;
    if (project.pdf_url.startsWith("http")) {
      const resp = await fetch(project.pdf_url);
      pdfBytes = new Uint8Array(await resp.arrayBuffer());
    } else {
      const { data: blob, error: dlErr } = await admin.storage.from("pdfs").download(project.pdf_url);
      if (dlErr || !blob) throw new Error("Failed to download PDF: " + (dlErr?.message || ""));
      pdfBytes = new Uint8Array(await blob.arrayBuffer());
    }

    // Render with mupdf
    const doc = (mupdf as any).Document.openDocument(pdfBytes, "application/pdf");
    const numPages = doc.countPages();

    // Target ~300dpi (pdf is 72dpi base). Use zoom matrix.
    const zoom = 300 / 72;
    const matrix = (mupdf as any).Matrix.scale(zoom, zoom);

    const updates: { page_number: number; hd_url: string }[] = [];
    for (let pageNum = chapter.start_page; pageNum <= chapter.end_page; pageNum++) {
      if (pageNum < 1 || pageNum > numPages) continue;
      const page = doc.loadPage(pageNum - 1);
      const pixmap = page.toPixmap(matrix, (mupdf as any).ColorSpace.DeviceRGB, false, true);
      const pngBytes: Uint8Array = pixmap.asPNG();

      const path = `${userId}/${project_id}/pag_${String(pageNum).padStart(4, "0")}.png`;
      const up = await admin.storage.from("page-images-hd").upload(path, pngBytes, { contentType: "image/png", upsert: true });
      if (up.error) throw new Error(`Upload failed for page ${pageNum}: ${up.error.message}`);
      const { data: urlData } = admin.storage.from("page-images-hd").getPublicUrl(path);
      const hdUrl = urlData.publicUrl;

      await admin.from("pages").update({ image_hd_url: hdUrl } as any).eq("project_id", project_id).eq("page_number", pageNum);
      updates.push({ page_number: pageNum, hd_url: hdUrl });

      pixmap.destroy?.();
      page.destroy?.();
    }
    doc.destroy?.();

    return new Response(JSON.stringify({ success: true, updated: updates.length, pages: updates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[reprocess-pages-highres]", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});