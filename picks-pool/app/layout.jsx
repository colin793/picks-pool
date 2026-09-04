import { IBM_Plex_Sans, Barlow_Condensed } from 'next/font/google';
import './globals.css';

const body = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });

export const metadata = {
  title: { default: 'Picks Pool', template: '%s · Picks Pool' },
  description: 'Pick winners with your friends. Most correct takes the pot.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Picks Pool' },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#111827' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1319' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
