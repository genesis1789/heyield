import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Earn Concierge — LI.FI voice demo",
  description:
    "Natural-language Earn concierge. Describe your idle cash, get one real recommendation, fund it via Revolut, watch it invest.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900 antialiased">{children}</body>
    </html>
  );
}
