"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { readScan } from "@/lib/scan";
import { SITE_URL } from "@/lib/site";

// Not in TypeScript's DOM types yet. Chrome, Edge and Android ship it; Safari and Firefox do not.
type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: { new (options: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> };
  }
}

type Decode = (video: HTMLVideoElement) => Promise<string | null>;

// The browser's own detector when it reads QR codes; otherwise jsQR, loaded only now so the
// pages that never scan do not carry it.
async function makeDecoder(): Promise<Decode> {
  const Native = window.BarcodeDetector;
  if (Native && (await Native.getSupportedFormats()).includes("qr_code")) {
    const detector = new Native({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return async (video) => {
    // Scaled down: jsQR runs on the main thread and 640 px is plenty for a code held up close.
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

// A button that opens the camera. A wallet's address code fills the field through
// `onAddress`; a code with one of our proposal or trade links opens it in the app.
export function ScanButton({ onAddress, label = "Scan QR" }: { onAddress?: (address: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost shrink-0 px-3" onClick={() => setOpen(true)}>
        <QrIcon />
        <span>{label}</span>
      </button>
      {open && (
        <ScannerDialog
          onClose={() => setOpen(false)}
          onAddress={
            onAddress &&
            ((a) => {
              onAddress(a);
              setOpen(false);
            })
          }
        />
      )}
    </>
  );
}

function ScannerDialog({ onClose, onAddress }: { onClose: () => void; onAddress?: (address: string) => void }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // Kept in a ref so the scanning loop sees the latest callbacks without restarting the camera.
  const handlers = useRef({ onAddress, onClose });
  handlers.current = { onAddress, onClose };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const origins = [window.location.origin, new URL(SITE_URL).origin];

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot open the camera.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return;
        const el = video.current!;
        el.srcObject = stream;
        await el.play();
        const decode = await makeDecoder();

        const tick = async () => {
          if (stopped) return;
          const text = el.readyState >= 2 ? await decode(el).catch(() => null) : null;
          const scanned = text ? readScan(text, origins) : null;
          if (scanned?.kind === "link") {
            handlers.current.onClose();
            router.push(scanned.path);
            return;
          }
          if (scanned?.kind === "address" && handlers.current.onAddress) {
            handlers.current.onAddress(scanned.address);
            return;
          }
          if (text) setHint(scanned ? "That is an address; scan a proposal or trade code here." : "That code is not an address or an Avocate link.");
          frame = window.setTimeout(tick, 200);
        };
        tick();
      } catch (e) {
        const denied = e instanceof DOMException && e.name === "NotAllowedError";
        setError(denied ? "Camera access was denied. Allow it in the browser, or type the address instead." : e instanceof Error ? e.message : "The camera could not be opened.");
      }
    })();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handlers.current.onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      stopped = true;
      window.clearTimeout(frame);
      window.removeEventListener("keydown", onKey);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-title"
        className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-ink/5 px-5 py-4">
          <h3 id="scan-title" className="text-lg font-semibold">
            Scan a QR code
          </h3>
          <p className="mt-0.5 text-sm text-ink/70">
            {onAddress ? "A wallet's address, or an Avocate proposal or trade code." : "An Avocate proposal or trade code."}
          </p>
        </div>
        <div className="px-5 py-4">
          {error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : (
            <video ref={video} muted playsInline className="aspect-square w-full rounded-xl bg-ink object-cover" />
          )}
          {hint && !error && (
            <p className="mt-3 text-sm text-ink/70" aria-live="polite">
              {hint}
            </p>
          )}
        </div>
        <div className="border-t border-ink/5 px-5 py-4">
          <button type="button" className="btn-ghost w-full" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M8 12h8" />
    </svg>
  );
}
