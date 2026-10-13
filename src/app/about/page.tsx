import Link from 'next/link';
import { SectionTitle } from '@/components/ui';

export const metadata = { title: '关于 OnlyPhoto' };

export default function AboutPage() {
  return (
    <div className="max-w-[760px] mx-auto px-4 md:px-8 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">关于 OnlyPhoto</h1>
      <p className="mt-4 text-body text-lg">
        OnlyPhoto 是一款面向普通手机摄影用户的 AI 摄影指导与机位社区。产品主张是
        <span className="text-ink font-medium">「看懂这张照片，拍好下一张」</span>。
      </p>

      <SectionTitle title="三个核心价值" />
      <ul className="mt-4 flex flex-col gap-3 text-body">
        <li>
          <strong className="text-ink">说得具体：</strong>指出画面依据，告诉用户下一步能做什么，而不是泛泛夸赞或审美打分。
        </li>
        <li>
          <strong className="text-ink">改得明白：</strong>区分“原图可修”和“需要重拍”，只对已经实现的处理提供一键预览。
        </li>
        <li>
          <strong className="text-ink">去得有据：</strong>点位不是一句地名，而是样张、站位、方向和条件的组合。
        </li>
      </ul>

      <SectionTitle title="第一版不做什么" />
      <p className="mt-4 text-body">
        不做原生移动应用、实时视频教练、复杂人脸美化、生成式换脸、自动推断精确拍摄坐标、全城路线规划、私信、直播或付费会员。
        不对人脸、身材、年龄、性别、健康、种族等作评分或推断。
      </p>

      <p className="mt-8 text-body">
        数据使用方式见 <Link href="/privacy" className="text-accent hover:underline">数据使用说明</Link>。
      </p>
    </div>
  );
}