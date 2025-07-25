import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { AuthProvider } from "@/app/context/auth-context";
import { LayoutSwitcher } from "./layout-switcher";
import WhatsAppWidget from "@/components/widgets/whatsapp-widget";

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
      <body className="bg-background text-foreground" suppressHydrationWarning={true}>
        <AuthProvider>
          <LayoutSwitcher>{children}</LayoutSwitcher>
          <WhatsAppWidget businessId="782e1021-058f-4eb1-b3fe-9c374d814799" />
        </AuthProvider>
      </body>
    </html>
  );
}