import { ImageResponse } from "next/og";

export const alt = "AvoVibe – Free Calorie & Macro Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const runtime = "edge";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 48,
          background: "#B8553F",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 12 }}>AvoVibe</div>
        <div style={{ fontSize: 28, opacity: 0.95 }}>Free Calorie & Macro Tracker</div>
      </div>
    ),
    { ...size }
  );
}
