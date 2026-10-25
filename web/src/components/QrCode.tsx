"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

// Drawn as SVG from our own link, so it scales crisply and needs no image request. A phone
// camera reads it and opens the link directly; no scanner is needed in the app.
export function QrCode({ value, label }: { value: string; label: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "L");
    qr.addData(value);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [value]);

  return (
    <div
      role="img"
      aria-label={label}
      className="mx-auto w-full max-w-[260px] rounded-xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
