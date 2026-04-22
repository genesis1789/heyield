import type { Metadata, Viewport } from "next";
import "./stage.css";

export const metadata: Metadata = {
  title: "Voice Concierge",
  description: "Talk to your money. Watch it invest.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b10",
};

/**
 * Phone-first, full-bleed layout. Renders its own `<html>`/`<body>` under the
 * `/stage` route so the audience-facing surface is completely isolated from
 * the operator dashboard's chrome and background gradient.
 */
export default function StageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="stage-root">{children}</div>;
}
