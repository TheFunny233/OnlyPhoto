import Link from 'next/link';
import { SparkleIcon, SlidersIcon, MapIcon, UploadIcon, CompassIcon } from '@/components/icons';
import { ButtonLink, Card, SectionTitle } from '@/components/ui';
import { SpotCard } from '@/components/SpotCard';
import { listSpots } from '@/lib/services/spots';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const FEATURES = [
  {
    icon: SparkleIcon,
    title: '说得具体',
    body: '指出画面依据，告诉你可以先做什么，而不是泛泛夸赞或审美打分。',
  },
  {
    icon: SlidersIcon,
    title: '改得明白',
    body: '区分“原图可修”和“需要重拍”，只对已经实现的处理提供一键预览与导出。',
  },
  {
    icon: MapIcon,
    title: '去得有据',
    body: '机位不是一句地名，而是样张、站位、方向、条件和来源的组合。',
  },
];

export default function HomePage() {
  let featured: ReturnType<typeof listSpots> = [];
  try {
    featured = listSpots({ limit: 3 });
  } catch {
    featured = [];
  }

  return (
    <div>
      <section className="max-w-[980px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-12 text-center">
        <p className="text-sm font-medium text-accent">AI 摄影优化与真实机位社区</p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight text-ink">
          看懂这张照片，拍好下一张
        </h1>
        <p className="mt-5 text-lg text-body max-w-2xl mx-auto">
          PhotoMaster 让你上传一张自己的照片，获得有依据的点评、可预览的修改建议，并在真实地图上发现和分享“站在哪里、朝哪里拍”。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/studio" size="lg" data-testid="home-upload-cta">
            <UploadIcon /> 上传照片开始
          </ButtonLink>
          <ButtonLink href="/explore" size="lg" variant="outline">
            <CompassIcon /> 打开地图发现机位
          </ButtonLink>
        </div>
        <div className="mt-10 rounded-card overflow-hidden shadow-card bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/demo/hero.jpg"
            alt="一张用于展示 PhotoMaster 的示例摄影作品（演示用图）"
            className="w-full aspect-[16/9] object-cover"
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          图为演示用示例图片；演示模式下不会假装对任意新图给出针对性结论。
        </p>
      </section>

      <section className="bg-surface mt-8">
        <div className="max-w-[980px] mx-auto px-4 md:px-8 py-16 md:py-24">
          <SectionTitle
            eyebrow="真实功能"
            title="先看依据，再谈下一步"
            description="PhotoMaster 不追求“万能修图”，只把基础的三件事做扎实。"
            center
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="p-8">
                <feature.icon className="h-7 w-7 text-accent" />
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-ink">{feature.title}</h3>
                <p className="mt-2 text-body">{feature.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[980px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <SectionTitle eyebrow="真实机位" title="从地图出发，跟着拍法走" />
          <Link href="/explore" className="text-accent hover:underline text-sm">
            查看全部机位 →
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {featured.map((spot) => (
              <SpotCard key={spot.id} spot={spot} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-body">
            还没有公开机位。你可以成为第一个发布机位的人 ——
            <Link href="/publish" className="text-accent hover:underline">
              去发布
            </Link>
            。
          </p>
        )}
      </section>

      <section className="bg-surface">
        <div className="max-w-[980px] mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">准备好拍好下一张了吗？</h2>
          <p className="mt-3 text-body max-w-xl mx-auto">
            注册后上传一张照片，PhotoMaster 会说明它看到了什么，以及最值得先做的一件事。
          </p>
          <div className="mt-8 flex justify-center gap-3 flex-wrap">
            <ButtonLink href="/register">创建账号</ButtonLink>
            <ButtonLink href="/studio" variant="outline">
              先上传试试
            </ButtonLink>
          </div>
          {env.demoMode ? (
            <p className="mt-6 text-xs text-muted">当前为演示模式（APP_DEMO_MODE=true），示例内容均已标注。</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}