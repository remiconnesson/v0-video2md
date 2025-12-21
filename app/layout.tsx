import { StackProvider, StackTheme } from "@stackframe/stack";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { stackClientApp } from "../stack/client";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
              <StackTheme>{children}</StackTheme>
            </StackProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
