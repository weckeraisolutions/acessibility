import { beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { Blob as NodeBlob } from "node:buffer";
import { uploadFile, downloadUrl, fileId, fileReference, fetchStoredFile, deleteProject, invokeStudioFunction, SESSION_EXPIRED_EVENT } from "./storage";

const { invoke, from, eq } = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke }, from } }));
const id = "11111111-1111-4111-8111-111111111111";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", fetchMock);
  from.mockReturnValue({ delete: () => ({ eq }) });
  eq.mockResolvedValue({ error: null });
});
describe("R2 contract", () => {
  it("hashes bytes, sends exact upload headers, and confirms before returning a reference", async () => {
    const headers = { "content-type": "application/pdf", "x-amz-checksum-sha256": "signed-checksum" };
    invoke.mockResolvedValueOnce({ data: { file_id: id, upload_method: "PUT", upload_url: "https://upload.invalid", upload_headers: headers }, error: null })
      .mockResolvedValueOnce({ data: { file: { status: "uploaded" } }, error: null });
    fetchMock.mockResolvedValue({ ok: true });
    const blob = new NodeBlob(["abc"], { type: "application/pdf" }) as unknown as Blob;
    expect(await uploadFile(blob, { project_id: "project", kind: "pdf", file_name: "test.pdf" })).toBe("r2:" + id);
    expect(invoke.mock.calls[0][1].body.checksum_sha256).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(fetchMock).toHaveBeenCalledWith("https://upload.invalid", { method: "PUT", headers, body: blob });
    expect(invoke.mock.calls[1][1].body).toEqual({ action: "complete-upload", file_id: id });
  });
  it("does not complete a failed PUT and attempts cleanup", async () => {
    invoke.mockResolvedValueOnce({ data: { file_id: id, upload_method: "PUT", upload_url: "https://upload.invalid", upload_headers: {} }, error: null })
      .mockResolvedValue({ data: { deleted: true }, error: null });
    fetchMock.mockResolvedValue({ ok: false });
    await expect(uploadFile(new NodeBlob(["a"]) as unknown as Blob, { project_id: "p", kind: "pdf", file_name: "a.pdf" })).rejects.toThrow("Falha no envio");
    expect(invoke.mock.calls[1][1].body.action).toBe("delete");
  });
  it("explains a network or CORS failure and cleans the pending upload", async () => {
    invoke.mockResolvedValueOnce({ data: { file_id: id, upload_method: "PUT", upload_url: "https://upload.invalid", upload_headers: {} }, error: null })
      .mockResolvedValue({ data: { deleted: true }, error: null });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(uploadFile(new NodeBlob(["a"]) as unknown as Blob, { project_id: "p", kind: "pdf", file_name: "a.pdf" })).rejects.toThrow("armazenamento de arquivos");
    expect(invoke.mock.calls[1][1].body.action).toBe("delete");
  });
  it("renews a displayed signed URL using its stable file id", async () => {
    invoke.mockResolvedValue({ data: { url: "https://download.invalid/file", expires_in: 900 }, error: null });
    const url = await downloadUrl("r2:" + id);
    expect(fileId(url)).toBe(id);
    expect(fileReference(url)).toBe("r2:" + id);
    await downloadUrl(url, true);
    expect(invoke.mock.calls[1][1].body).toEqual({ action: "create-download", file_id: id, as_attachment: true });
  });
  it("rejects unknown external URLs rather than persisting or fetching them", async () => {
    await expect(downloadUrl("https://other.invalid/file")).rejects.toThrow("Arquivo indisponível");
    expect(invoke).not.toHaveBeenCalled();
  });
  it("fails downloads on non-OK HTTP responses", async () => {
    invoke.mockResolvedValue({ data: { url: "https://download.invalid/missing" }, error: null });
    fetchMock.mockResolvedValue({ ok: false });
    await expect(fetchStoredFile("r2:" + id)).rejects.toThrow("Falha ao baixar");
  });
  it("purges before deleting the project row", async () => {
    invoke.mockResolvedValue({ data: { deleted: 3 }, error: null });
    await deleteProject("project");
    expect(invoke.mock.calls[0][1].body).toEqual({ action: "purge-project", project_id: "project" });
    expect(invoke.mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[0]);
  });
  it("keeps the project row if purge fails", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("R2 unavailable") });
    await expect(deleteProject("project")).rejects.toThrow("R2 unavailable");
    expect(from).not.toHaveBeenCalled();
  });
  it("announces expired sessions", async () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    invoke.mockResolvedValue({ data: null, error: { context: { status: 401 } } });
    await expect(invokeStudioFunction("r2-files", {})).rejects.toThrow("sessão expirou");
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
  it("does not reveal ownership for inaccessible files", async () => {
    invoke.mockResolvedValue({ data: null, error: { context: { status: 404 } } });
    await expect(downloadUrl("r2:" + id)).rejects.toThrow("Acesso negado");
  });
});
