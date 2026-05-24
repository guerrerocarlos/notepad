import type { Metadata } from 'next'
import { Geist, Geist_Mono, Vazirmatn } from 'next/font/google'
import Script from 'next/script'
import { MobileWall } from '@/components/mobile-wall'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nodepad.space'
const siteOrigin = new URL(siteUrl).origin
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: 'nodepad',
  description: 'A spatial research tool where AI augments your thinking — not replaces it.',
  icons: {
    icon: [{ url: `${basePath}/icon.svg`, type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'nodepad',
    description: 'A spatial research tool where AI augments your thinking — not replaces it.',
    url: siteUrl,
    siteName: 'nodepad',
    images: [{ url: `${basePath}/nodepad.jpg`, width: 1200, height: 630, alt: 'nodepad' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'nodepad',
    description: 'A spatial research tool where AI augments your thinking — not replaces it.',
    images: [`${basePath}/nodepad.jpg`],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased ${vazirmatn.variable}`} suppressHydrationWarning>
        <MobileWall />
        {children}
        {/* Umami analytics — nodepad.space only. Remove or replace with your
            own data-website-id if self-hosting. Safe to delete entirely. */}
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="334833bb-9911-4ddb-b3f2-6df25795cd0e"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
