import { Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import logo from "../public/SkedyLogo.png";
import { Footer } from "@components/layout/footer";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Navbar from "@components/layout/navbar";
import AnimatedBackground from "@/components/AnimatedBackground";
import { Suspense } from "react";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Skedy - AI-Powered Booking Management",
  description: "We help mobile businesses manage their bookings and calendars with AI agents. Streamline your operations and delight your customers.",
  keywords: "booking management, calendar automation, AI agents, mobile business, scheduling",
  authors: [{ name: "Skedy Team" }],
  openGraph: {
    title: "Skedy - AI-Powered Booking Management",
    description: "We help mobile businesses manage their bookings and calendars with AI agents.",
    type: "website",
    url: defaultUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Skedy - AI-Powered Booking Management",
    description: "We help mobile businesses manage their bookings and calendars with AI agents.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(inter.className)}>
      <body className="bg-background text-foreground">
        <AnimatedBackground />
        <main className="min-h-screen flex flex-col">
          <div className="flex-1 w-full flex flex-col items-center">
            <Navbar />
            <div className="flex flex-col gap-20 max-w-5xl p-5 relative z-10">
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[200px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }>
                {children}
              </Suspense>
            </div>
            <Footer />
          </div>
        </main>
      </body>
    </html>
  );
}
