import { StackProvider, StackTheme } from "@stackframe/stack";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { stackClientApp } from "../stack/client";
import "./globals.css";

const geistSans = localFont({
  src: [
    {
      path: "../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
      style: "normal",
      weight: "100 900",
    },
  ],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: [
    {
      path: "../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
      style: "normal",
      weight: "100 900",
    },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Video2MD - Knowledge Base Ingestion",
  description:
    "Import content from YouTube or upload your own materials to build your knowledge base",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NuqsAdapter>
            <StackProvider app={stackClientApp}>
              <StackTheme>
                <div className="fixed right-4 top-4 z-50">
                  <ThemeToggle />
                </div>
                {children}
              </StackTheme>
            </StackProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
