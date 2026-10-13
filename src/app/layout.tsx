import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Tracking } from "@/components/site/tracking";
import { ensureSettings } from "@/lib/settings-store";
import { getPublicTracking } from "@/services/tracking";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Name, description and icon come from Settings > Site.
export async function generateMetadata(): Promise<Metadata> {
  const { site } = await ensureSettings();
  return {
    title: {
      default: site.name,
      template: `%s · ${site.name}`,
    },
    description: site.description || undefined,
    icons: site.faviconUrl ? { icon: site.faviconUrl } : undefined,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { payment } = await ensureSettings();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* The site currency for price formatting in the browser: see siteCurrency() in src/lib/format.ts. */}
        <script dangerouslySetInnerHTML={{ __html: `globalThis.__lmsCurrency=${JSON.stringify(payment.currency)}` }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Tracking config={getPublicTracking()} />
      </body>
    </html>
  );
}
