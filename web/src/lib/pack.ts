// Compact, URL-safe packing for transactions that travel in a link or a QR code:
// raw deflate (built into every current browser and Node) plus base64url.

export async function pack(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const b of packed) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Rejects anything that does not decode and inflate cleanly, and caps the inflated size so
// a crafted link cannot make the page inflate a huge payload.
export async function unpack(code: string, maxBytes = 16_384): Promise<Uint8Array> {
  if (!/^[A-Za-z0-9_-]+$/.test(code)) throw new Error("bad characters");
  const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("payload too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
