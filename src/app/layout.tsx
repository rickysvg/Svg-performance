import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { Anton, Geist } from "next/font/google";
import Script from "next/script";
import { AppSplash } from "@/components/AppSplash";
import { FirstTouchCapture } from "@/components/FirstTouchCapture";
import { NativeAppBridge } from "@/components/native/NativeAppBridge";
import { FIRST_TOUCH_BOOT_SCRIPT } from "@/lib/first-touch";
import { telemetryFont } from "@/lib/telemetry-font";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://svgperformance.app"),
  title: "SVG Performance",
  description:
    "Strength, conditioning and fight training for combat athletes. The app is live on the web. Train on the web. Open it on your phone, no download needed.",
  applicationName: "SVG Performance",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SVG Performance",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon-64.png",
    apple: "/svg-performance-badge-mark.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#07080a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${geistSans.variable} ${telemetryFont.variable} h-full antialiased`}
      // The splash script sets data-splash on this element before hydrate.
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <Script id="splash-seen" strategy="beforeInteractive">
          {`try{if(sessionStorage.getItem("svg_splash_seen")==="1")document.documentElement.dataset.splash="done"}catch(e){}`}
        </Script>
        <Script id="first-touch" strategy="beforeInteractive">
          {FIRST_TOUCH_BOOT_SCRIPT}
        </Script>
        <Suspense fallback={null}>
          <FirstTouchCapture />
        </Suspense>
        <AppSplash />
        <NativeAppBridge />
        {children}
      </body>
    </html>
  );
}
