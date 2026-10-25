import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Avocate Harvest Escrow: farmers paid in seconds when the harvest arrives";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#E8F5EF",
          color: "#0B1F17",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>
          AVOCATE<span style={{ color: "#007A4D", fontWeight: 400, marginLeft: 14, letterSpacing: 0 }}>Harvest Escrow</span>
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.1, maxWidth: 940 }}>
          Farmers paid in seconds when the harvest arrives.
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#0B1F17", opacity: 0.75 }}>
          USDC escrow on Stellar · advances from a financing pool · testnet beta
        </div>
      </div>
    ),
    size,
  );
}
