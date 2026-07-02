import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";
import { CookieNotice } from "@/components/legal/cookie-notice";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "DecisionOS: Team Decision Intelligence",
  description: "A structured system of record for team decisions. Record why decisions were made, who made them, and whether they worked.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${spaceMono.variable}`}>
      <body className="min-h-full flex flex-col">
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
