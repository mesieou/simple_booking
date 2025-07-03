import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { AuthProvider } from "@/app/context/auth-context";
import { LayoutSwitcher } from "./layout-switcher";

const defaultUrl = process.env.NEXT_PUBLIC_SITE_URL || 
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://skedy.io");

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

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <AuthProvider>
          <LayoutSwitcher>{children}</LayoutSwitcher>
        </AuthProvider>
      </body>
    </html>
  );
}