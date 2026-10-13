/* eslint-disable @next/next/no-img-element -- ImageResponse draws plain <img>; next/image does not apply here. */
// The picture shown when a link to the site is shared (LINE, Messenger,
// Facebook, X…). Rendered once at build time; every page uses it unless it
// has an opengraph-image of its own.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "GED Prep — a study plan for the GED, made around your free time";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [logo, mascot] = await Promise.all(
    ["logo.png", "mascot.png"].map((f) => readFile(join(process.cwd(), "assets/og", f), "base64"))
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 80px",
          background: "linear-gradient(150deg, #e8f2ff 0%, #f4f8ff 55%, #dbeafe 100%)",
          color: "#0f2748",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <img src={`data:image/png;base64,${logo}`} width={96} height={96} alt="" />
            <span style={{ fontSize: 60, fontWeight: 800, letterSpacing: -1 }}>GED Prep</span>
          </div>
          <span style={{ marginTop: 36, fontSize: 46, fontWeight: 800, lineHeight: 1.15 }}>
            A study plan for the GED, made around your free time.
          </span>
          <span style={{ marginTop: 22, fontSize: 26, color: "#5b769a", lineHeight: 1.4 }}>
            Math · Language Arts · Science · Social Studies
          </span>
          <span
            style={{
              marginTop: 34,
              display: "flex",
              alignSelf: "flex-start",
              padding: "12px 26px",
              borderRadius: 999,
              background: "#1e90e8",
              color: "white",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            ged-nn.com
          </span>
        </div>
        <img src={`data:image/png;base64,${mascot}`} width={440} height={303} alt="" />
      </div>
    ),
    size
  );
}
