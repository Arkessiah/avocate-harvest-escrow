"use client";

import { useEffect, useState } from "react";
import { ScanButton } from "@/components/QrScanner";

export function TradeLoader({ current, onLoad }: { current: string | null; onLoad: (id: string) => void }) {
  const [value, setValue] = useState(current ?? "");
  useEffect(() => setValue(current ?? ""), [current]);

  return (
    <form
      className="mb-4 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onLoad(value.trim());
      }}
    >
      <label htmlFor="trade-id" className="sr-only">
        Trade address
      </label>
      <input
        id="trade-id"
        className="input min-w-0 basis-full font-mono sm:flex-1 sm:basis-auto"
        placeholder="Paste a trade address (C…)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      <button className="btn-ghost shrink-0" type="submit">
        Open trade
      </button>
      <ScanButton />
    </form>
  );
}
