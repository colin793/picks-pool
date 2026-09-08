import { IBM_Plex_Sans, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import PushSetup from './components/PushSetup';

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

// Runs before first paint so a chosen theme never flashes the other one.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <PushSetup />
        {children}
      </body>
    </html>
  );
}
