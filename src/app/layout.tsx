import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "One Bron Afon Plan — the Big Plan",
  description: "A rolling 18-month view of Bron Afon's significant work, for prioritisation and capacity planning.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body><a href="#main" className="skip-link">Skip to main content</a>{children}</body>
    </html>
  );
}
