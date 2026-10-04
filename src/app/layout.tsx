import type {Metadata, Viewport} from 'next';
import {Cinzel, Grenze_Gotisch, Inter} from 'next/font/google';
import {GeistMono} from 'geist/font/mono';

import './globals.css';
import {BottomNav} from '@/components/BottomNav';
import {MainContentWrapper} from '@/components/MainContentWrapper';
import {Providers} from '@/components/Providers';
import {Sidebar} from '@/components/Sidebar';
import {TopBar} from '@/components/TopBar';
import {WorkspaceProvider} from '@/components/WorkspaceContext';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

/**
 * Wordmark faces, self-hosted by next/font at build time.
 *
 * These are only ever applied inside the <Wordmark> SVG and the generated icon
 * files; the interface itself stays on Inter so the body copy keeps its current
 * metrics. `display: 'swap'` with a serif fallback means the mark still renders
 * if the font request is slow or blocked.
 */
const grenzeGotisch = Grenze_Gotisch({
  subsets: ['latin'],
  weight: '800',
  display: 'swap',
  variable: '--font-grenze-gotisch',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-cinzel',
});

export const metadata: Metadata = {
  title: {
    default: 'Hanssimiko Bunker — Native 0G Timelock',
    template: '%s · Hanssimiko Bunker',
  },
  description:
    'Hanssimiko Bunker is a non-custodial timelock for native 0G on 0G Chain. No yield, no APR, no administrative backdoors.',
  applicationName: 'Hanssimiko Bunker',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      {url: '/favicon.svg', type: 'image/svg+xml'},
      {url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon'},
    ],
    apple: [{url: '/apple-touch-icon.png', sizes: '180x180'}],
  },
  robots: {index: true, follow: true},
  openGraph: {
    title: 'Hanssimiko Bunker',
    description: 'Non-custodial timelock vault for native 0G.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the layout paint into the notch area on iOS instead of letterboxing.
  viewportFit: 'cover',
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${GeistMono.variable} ${grenzeGotisch.variable} ${cinzel.variable} dark`}
    >
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)] antialiased selection:bg-[var(--color-primary)] selection:text-[var(--color-fg)]">
        <Providers>
          <WorkspaceProvider>
            <TopBar />
            <div className="app-shell flex min-w-0">
              <Sidebar />
              <MainContentWrapper>{children}</MainContentWrapper>
            </div>
            <BottomNav />
          </WorkspaceProvider>
        </Providers>
      </body>
    </html>
  );
}
