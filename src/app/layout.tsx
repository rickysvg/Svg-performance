import type { Metadata } from "next";
import { Anton, Geist } from "next/font/google";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("svg_splash_seen")==="1")document.documentElement.dataset.splash="done"}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
