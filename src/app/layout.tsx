import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Afterglow — a WebGL material studio",
  description:
    "Five hand-written GLSL materials you can tune, recolour, export and share. Built with Next.js, React, TypeScript, Tailwind CSS and raw WebGL2.",
  applicationName: "Afterglow",
  openGraph: {
    title: "Afterglow — a WebGL material studio",
    description: "Five hand-written GLSL materials you can tune, recolour, export and share.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-ink font-sans text-paper">{children}</body>
    </html>
  );
}
