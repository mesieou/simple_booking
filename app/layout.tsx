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
  // Use correct business ID based on environment
  const getBusinessId = (): string => {
    if (process.env.NODE_ENV === 'production') {
      return '42f7bb6e-c4bb-4556-b33e-d2858612bd4c'; // Production business ID
    }
    return '495c1537-d2cb-4557-b498-25c44961e506'; // Development business ID
  };

  return (
    <html lang="en" className={cn(inter.className)}>
      <body className="bg-background text-foreground" suppressHydrationWarning={true}>
        <AuthProvider>
          <LayoutSwitcher>{children}</LayoutSwitcher>
          <WhatsAppWidget businessId={getBusinessId()} />
        </AuthProvider>
      </body>
    </html>
  );
}