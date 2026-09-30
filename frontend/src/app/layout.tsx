import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Nav } from "@/components/nav";
import { ThemeProvider } from "@/components/theme";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Inter is the main UI face on zoko.io; Geist Mono only for phone numbers.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Support Intelligence",
  description: "What is happening with the support team, and how to improve it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider>
          <a href="#main-content" className="sr-only z-50 rounded-md bg-card p-3 text-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>
          <div className="flex min-h-dvh flex-col md:flex-row">
            <Nav />
            <div className="flex min-w-0 flex-1 flex-col">{children}</div>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
