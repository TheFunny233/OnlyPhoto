import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteNav } from '@/components/SiteNav';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: {
    default: 'OnlyPhoto — 看懂这张照片，拍好下一张',
    template: '%s — OnlyPhoto',
  },
  description:
    'OnlyPhoto 上传照片即可获得有依据的摄影点评、可预览的修图建议，并在真实地图上发现和分享拍摄机位。',
  applicationName: 'OnlyPhoto',
  manifest: '/manifest.webmanifest',
  appleWebApp: { title: 'OnlyPhoto' },
};

export const viewport: Viewport = {
  themeColor: '#f5f5f7',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-2 focus:rounded-control focus:shadow-card"
        >
          跳到主要内容
        </a>
        <SiteNav />
        <main id="main" className="flex-1 w-full">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}