import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brandprint — Brand guide from any live website",
  description: "Paste a website or company name and get a usable brand guide: logo, colour palette, typography, tone of voice and key messaging, extracted live with TinyFish.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
