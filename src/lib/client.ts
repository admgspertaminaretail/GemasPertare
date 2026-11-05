/** Helper fetch sisi klien: mengembalikan JSON atau melempar Error berpesan Indonesia. */
export async function api<T = any>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      method: body === undefined && method === "GET" ? "GET" : method,
      headers: isForm || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* bukan JSON */ }
  if (res.status === 401) { window.location.href = "/login"; throw new Error("Sesi berakhir."); }
  if (!res.ok) throw new Error(data?.error || `Permintaan gagal (${res.status}).`);
  return data as T;
}
