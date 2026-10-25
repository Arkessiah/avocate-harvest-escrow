"use client";

import { useEffect, useState } from "react";
import { QrCode } from "@/components/QrCode";

// Byte-mode capacity of the largest QR code at the lowest error correction is 2,953; past
// that the encoder throws, so longer links are shared only as text.
const QR_MAX = 2_900;

// One link, every way of handing it over: a QR code for someone standing next to you, or a
// message app, email or the phone's own share sheet for someone who is not. The link opens
// in the app; nothing is sent until the other person signs there.
export function ShareLink({
  url,
  message,
  subject,
  qrLabel,
  showQr = true,
}: {
  url: string;
  message: string;
  subject: string;
  qrLabel: string;
  showQr?: boolean;
}) {
  const fits = url.length <= QR_MAX;
  const [qr, setQr] = useState(showQr && fits);
  const [copied, setCopied] = useState(false);
  // navigator.share exists only on the client; checked after mount to match the server render.
  const [native, setNative] = useState(false);
  useEffect(() => setNative(typeof navigator.share === "function"), []);

  const text = `${message}\n${url}`;
  const targets = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(text)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}` },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link stays selectable in the field below.
    }
  }

  return (
    <div className="grid gap-3">
      {qr && <QrCode value={url} label={qrLabel} />}

      <div className="flex flex-wrap gap-2">
        {native && (
          <button
            type="button"
            className="btn-brand px-3 py-2 text-sm"
            onClick={() => navigator.share({ title: subject, text: message, url }).catch(() => {})}
          >
            Share…
          </button>
        )}
        {targets.map((t) => (
          <a key={t.label} href={t.href} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-sm">
            {t.label}
          </a>
        ))}
        <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
        {fits && (
          <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => setQr((v) => !v)} aria-pressed={qr}>
            {qr ? "Hide QR" : "Show QR"}
          </button>
        )}
      </div>

      {!fits && <p className="text-xs text-ink/70">This link is too long for a QR code: send it by message or email.</p>}

      <input
        className="input font-mono text-xs"
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        aria-label="Link to share"
      />
    </div>
  );
}
