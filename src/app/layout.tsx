import type { Metadata, Viewport } from "next";
import { Anton, Geist } from "next/font/google";
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
  themeColor: "#CBF805",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${geistSans.variable} h-full antialiased`}
      // The splash script sets data-splash on this element before hydrate.
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("svg_splash_seen")==="1")document.documentElement.dataset.splash="done"}catch(e){}`,
          }}
        />
        <AppSplash />
        {children}
      </body>
    </html>
  );
}
