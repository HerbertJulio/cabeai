import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const corpo = localFont({
  src: [
    { path: './fontes/barlow-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fontes/barlow-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fontes/barlow-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fontes/barlow-latin-700-normal.woff2', weight: '700', style: 'normal' }
  ],
  variable: '--fonte-corpo',
  display: 'swap'
});
const titulo = localFont({
  src: [
    { path: './fontes/barlow-condensed-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fontes/barlow-condensed-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fontes/barlow-condensed-latin-700-normal.woff2', weight: '700', style: 'normal' }
  ],
  variable: '--fonte-titulo',
  display: 'swap'
});

const DESC = 'Monte a planta da sua casa em escala: cômodos, andares, portas, janelas e móveis. Veja se cabe, se dá para passar e compare arrumações com a ajuda da IA. Grátis e de código aberto.';

export const metadata: Metadata = {
  metadataBase: new URL('https://cabeai.howlks.com'),
  title: 'Cabeaí · será que cabe? A planta da sua casa, em escala',
  description: DESC,
  applicationName: 'Cabeaí',
  openGraph: { title: 'Cabeaí', description: DESC, type: 'website', locale: 'pt_BR' },
  referrer: 'strict-origin-when-cross-origin'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1E5AA8' },
    { media: '(prefers-color-scheme: dark)', color: '#0E1114' }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${corpo.variable} ${titulo.variable}`}>
      <body>
        {children}
        <noscript><p className="sem-js">O Cabeaí precisa do JavaScript ligado no navegador. · Cabeaí needs JavaScript enabled in your browser.</p></noscript>
      </body>
    </html>
  );
}
