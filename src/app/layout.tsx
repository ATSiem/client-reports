import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/global.css";
import { AuthProvider } from "~/components/auth-provider";
import { BackgroundProcessorInit } from "~/components/background-processor-init";
import { ThemeProvider } from "~/components/theme-provider";

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
  // Run database migrations on server only
  if (typeof window === 'undefined') {
    import('~/lib/db/migration-manager').then(({ runMigrations }) => {
      runMigrations();
    });
  }
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ThemeProvider>
            <BackgroundProcessorInit />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
