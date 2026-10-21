import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AppSplash } from "@/components/AppSplash";
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

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SVG Performance",
  description:
    "Private preview for anyone who wants to improve performance — combat athletes and people getting in shape. From Ricky / SVG MMA Academy.",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The splash script sets data-splash on this element before hydrate.
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <Script id="splash-seen" strategy="beforeInteractive">
          {`try{if(sessionStorage.getItem("svg_splash_seen")==="1")document.documentElement.dataset.splash="done"}catch(e){}`}
        </Script>
        <AppSplash />
        {children}
      </body>
    </html>
  );
}
