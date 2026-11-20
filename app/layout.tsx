import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  manifest: "/site.webmanifest",
  title: {
    default: "KineticClips AI – Chat, write and turn text into speech",
    template: "%s | KineticClips AI",
  },
  description:
    "KineticClips AI is an AI assistant that answers questions, helps you write and code, and turns your text into natural-sounding audio.",
  applicationName: "KineticClips AI",
  openGraph: {
    type: "website",
    siteName: "KineticClips AI",
    title: "KineticClips AI – Chat, write and turn text into speech",
    description:
      "Ask anything, draft content and generate voice audio in one place.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KineticClips AI",
    description: "Ask anything, draft content and generate voice audio.",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}