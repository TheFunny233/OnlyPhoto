'use client';

import { useState } from 'react';
import { AlertIcon, CheckIcon, SparkleIcon } from '@/components/icons';
import { Badge } from '@/components/ui';
import type { AnalysisReceipt, PhotoAnalysis, PhotoFinding } from '@/lib/ai/types';

const PRIORITY_LABEL: Record<string, string> = { high: '优先级高', medium: '优先级中', low: '优先级低' };
const PRIORITY_TONE: Record<string, 'danger' | 'warn' | 'neutral'> = { high: 'danger', medium: 'warn', low: 'neutral' };
const CATEGORY_LABEL: Record<string, string> = {
  composition: '构图',
  light: '光线',
  color: '色彩',
  subject: '主体',
  background: '背景',
  other: '其他',
};

function FindingRow({
  finding,
  onFocusRegion,
  activeId,
}: {
  finding: PhotoFinding;
  onFocusRegion: (id: string) => void;
  activeId: string | null;
}) {
  return (
    <div
      className={`rounded-card border border-line p-5 transition-colors duration-200 ${
        activeId === finding.id ? 'bg-page' : 'bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-medium text-ink">{finding.title}</h4>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Badge tone="neutral">{CATEGORY_LABEL[finding.category] ?? finding.category}</Badge>
          <Badge tone={PRIORITY_TONE[finding.priority]}>{PRIORITY_LABEL[finding.priority]}</Badge>
        </div>
      </div>
      {finding.observation ? <p className="mt-2 text-sm text-body">{finding.observation}</p> : null}
      {finding.explanation ? <p className="mt-1 text-sm text-muted">{finding.explanation}</p> : null}
      {finding.action ? (
        <p className="mt-3 text-sm text-ink">
          <span className="font-medium">可以这样试：</span>
          {finding.action}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {finding.requiresReshoot ? <Badge tone="warn">需要重拍</Badge> : <Badge tone="success">可在当前照片调整</Badge>}
        {finding.certainty === 'tentative' ? <Badge tone="neutral">判断不确定</Badge> : null}
        {finding.region ? (
          <button
            type="button"
            onClick={() => onFocusRegion(finding.id)}
            className="text-accent hover:underline"
          >
            在照片上查看标注
          </button>
        ) : null}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'strengths', label: '优点' },
  { key: 'improvements', label: '可改进处' },
  { key: 'reshoot', label: '重拍建议' },
  { key: 'editing', label: '修图建议' },
] as const;

export function AnalysisView({
  analysis,
  receipt,
  onFocusRegion,
  activeId,
}: {
  analysis: PhotoAnalysis;
  receipt: AnalysisReceipt | null;
  onFocusRegion: (id: string) => void;
  activeId: string | null;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('improvements');

  return (
    <div>
      <div className="rounded-card bg-page p-5">
        <p className="text-sm text-body">{analysis.summary}</p>
        {receipt?.mode === 'mock' ? (
          <p className="mt-2 text-xs text-[#946200]">
            演示模式结果：未实际识别这张照片的具体内容。配置真实视觉模型后可获得针对性点评。
          </p>
        ) : null}
      </div>

      {analysis.firstAction ? (
        <div className="mt-4 rounded-card border border-accent/30 bg-accent/5 p-5">
          <div className="flex items-center gap-2 text-accent font-medium">
            <SparkleIcon className="h-5 w-5" /> 先做这一件事
          </div>
          <p className="mt-2 text-ink">{analysis.firstAction}</p>
        </div>
      ) : null}

      <div className="mt-6 flex gap-1 border-b border-line overflow-x-auto" role="tablist" aria-label="分析分区">
        {TABS.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors duration-200 ${
              tab === item.key ? 'border-accent text-ink font-medium' : 'border-transparent text-body hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {tab === 'strengths' &&
          (analysis.strengths.length > 0 ? (
            analysis.strengths.map((f) => (
              <FindingRow key={f.id} finding={f} onFocusRegion={onFocusRegion} activeId={activeId} />
            ))
          ) : (
            <p className="text-sm text-body">这张照片的优点没有把握明确指出，避免强行夸赞。</p>
          ))}

        {tab === 'improvements' &&
          (analysis.improvements.length > 0 ? (
            analysis.improvements.map((f) => (
              <FindingRow key={f.id} finding={f} onFocusRegion={onFocusRegion} activeId={activeId} />
            ))
          ) : (
            <p className="text-sm text-body flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-success" /> 没有需要特别指出的明显问题。
            </p>
          ))}

        {tab === 'reshoot' &&
          (analysis.reshootSuggestions.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {analysis.reshootSuggestions.map((s, i) => (
                <li key={i} className="rounded-card border border-line bg-surface p-4 text-sm text-body">
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-body">暂时没有必须重拍的建议。</p>
          ))}

        {tab === 'editing' &&
          (analysis.editingSuggestions.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {analysis.editingSuggestions.map((s, i) => (
                <li key={i} className="rounded-card border border-line bg-surface p-4 text-sm text-body">
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-body">没有针对当前照片的具体修改建议。</p>
          ))}
      </div>

      {analysis.uncertainties.length > 0 ? (
        <div className="mt-6 rounded-card border border-line bg-page p-5">
          <div className="flex items-center gap-2 text-body font-medium">
            <AlertIcon className="h-5 w-5" /> 不确定与不能判断的事项
          </div>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted flex flex-col gap-1">
            {analysis.uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {receipt ? (
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">来源信息（服务端生成）</summary>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-muted">
            <dt>模式</dt>
            <dd>{receipt.mode === 'live' ? '真实调用' : '演示模式'}</dd>
            <dt>供应商</dt>
            <dd>{receipt.provider}</dd>
            <dt>模型</dt>
            <dd>{receipt.model ?? '未知'}</dd>
            <dt>提示词版本</dt>
            <dd>{receipt.promptVersion}</dd>
            <dt>请求 ID</dt>
            <dd className="break-all">{receipt.providerRequestId ?? '无'}</dd>
            <dt>Token 用量</dt>
            <dd>
              {receipt.inputTokens ?? '未知'} / {receipt.outputTokens ?? '未知'}
            </dd>
            <dt>生成时间</dt>
            <dd>{new Date(receipt.generatedAt).toLocaleString('zh-CN')}</dd>
          </dl>
        </details>
      ) : null}
    </div>
  );
}