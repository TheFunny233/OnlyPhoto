import Link from 'next/link';
import { env } from '@/lib/env';

export function SiteFooter() {
  return (
    <footer className="bg-page border-t border-line mt-16">
      <div className="max-w-[980px] mx-auto px-4 md:px-8 py-12 grid gap-8 md:grid-cols-3 text-sm">
        <div>
          <span className="font-semibold tracking-tight text-ink text-lg">OnlyPhoto</span>
          <p className="text-muted mt-2 max-w-xs">看懂这张照片，拍好下一张。</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-medium text-ink">产品</span>
          <Link href="/studio" className="text-body hover:text-accent">
            分析工作台
          </Link>
          <Link href="/explore" className="text-body hover:text-accent">
            发现机位
          </Link>
          <Link href="/about" className="text-body hover:text-accent">
            关于 OnlyPhoto
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-medium text-ink">数据与地图</span>
          <Link href="/privacy" className="text-body hover:text-accent">
            数据使用说明
          </Link>
          <a
            href={env.map.copyrightUrl}
            className="text-body hover:text-accent"
            target="_blank"
            rel="noreferrer noopener"
          >
            © OpenStreetMap contributors
          </a>
        </div>
      </div>
    </footer>
  );
}