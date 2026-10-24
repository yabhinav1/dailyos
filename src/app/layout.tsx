import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/components/providers/session-provider";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import Toaster from "@/components/ui/toaster";
import OfflineBanner from "@/components/layout/offline-banner";
import ServiceWorkerRegistration from "@/components/providers/service-worker";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DailyOS — Personal Productivity OS",
  description:
    "Notes, tasks, habits, goals, calendar and study tracking in one workspace.",
};

// viewport-fit=cover lets the phone nav bar pad itself clear of the iPhone
// home indicator (env(safe-area-inset-bottom)).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0d0d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans min-h-screen bg-background text-foreground antialiased`}
      >
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              <ConfirmProvider>
                {children}
                <Toaster />
                <OfflineBanner />
                <ServiceWorkerRegistration />
              </ConfirmProvider>
            </TooltipProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
