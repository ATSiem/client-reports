import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/global.css";
import { AuthProvider } from "~/components/auth-provider";
import { BackgroundProcessorInit } from "~/components/background-processor-init";
import { ThemeProvider } from "~/components/theme-provider";
import { PHProvider } from "~/lib/posthog";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Client Reports",
  description: "Generate professional client communication reports",
  // Add cache control headers to prevent caching of authentication state
  other: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Migrations should not be run on every page render
  // Database initialization in db/index.ts already handles migrations
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <PHProvider>
          <AuthProvider>
            <ThemeProvider>
              <BackgroundProcessorInit />
              {children}
            </ThemeProvider>
          </AuthProvider>
        </PHProvider>
      </body>
    </html>
  );
}
