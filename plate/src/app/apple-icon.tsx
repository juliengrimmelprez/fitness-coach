import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon (iOS doesn't use SVG icons).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2f9e5b" }}>
        <div style={{ width: 110, height: 110, borderRadius: 999, border: "12px solid white", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, background: "white" }} />
        </div>
      </div>
    ),
    size,
  );
}
