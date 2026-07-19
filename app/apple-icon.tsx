import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0C10",
        }}
      >
        <span
          style={{
            fontSize: 110,
            fontWeight: 700,
            color: "#A855F7",
            fontFamily: "sans-serif",
          }}
        >
          K
        </span>
      </div>
    ),
    { ...size }
  );
}
