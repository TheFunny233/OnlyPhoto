import type { AdapterInput, AdapterSuccess } from './adapter-openai';
import { sceneLabel } from './types';

/**
 * Deterministic mock provider. It never claims to have inspected the actual pixels of an
 * arbitrary upload. For known demo assets it returns matched sample copy; otherwise it returns a
 * clearly labelled structural example so the UI/flow can be exercised without a live key.
 */
const DEMO_SAMPLE_HASHES: Record<string, { scene: string; summary: string; firstAction: string }> = {};

export function isKnownDemoImage(imageHash: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEMO_SAMPLE_HASHES, imageHash);
}

export function mockAnalysis(input: AdapterInput, imageHash: string): AdapterSuccess {
  const known = DEMO_SAMPLE_HASHES[imageHash];
  const sceneText = input.scene && input.scene !== 'auto' ? sceneLabel(input.scene) : '场景（自动）';
  const goalsText = input.goals.length > 0 ? `结合你选择的目标（${input.goals.length} 项）` : '在未指定目标的情况下';

  const raw = {
    schemaVersion: '1',
    scene: sceneText,
    summary: known
      ? known.summary
      : `演示模式：这是结构示例，并未真实识别这张照片的内容。真实点评需要配置视觉模型后开启 live 模式。`,
    strengths: [
      {
        category: 'composition',
        title: '演示：示例优点',
        observation: '示例文本，不代表对当前这张照片的实际判断。',
        explanation: '演示模式用于展示结果版式与分析流程。',
        action: '配置 AI_MODE=live 并填写视觉模型后重新分析。',
        priority: 'medium',
        certainty: 'tentative',
        region: null,
        requiresReshoot: false,
      },
    ],
    improvements: [
      {
        category: 'light',
        title: '演示：示例可改进处',
        observation: '示例文本，未对图像做真实判断。',
        explanation: '真实模式下会依据画面现象给出影响与优先级。',
        action: '在真实模式下重新分析以获得针对性建议。',
        priority: 'low',
        certainty: 'tentative',
        region: null,
        requiresReshoot: false,
      },
    ],
    reshootSuggestions: [`${goalsText}，真实模式下会给出可尝试的站位、方向与光线条件。`],
    editingSuggestions: ['演示模式不提供针对当前照片的具体修图参数。'],
    recommendedRecipe: null,
    firstAction: known
      ? known.firstAction
      : '先配置真实视觉模型，再根据实际画面决定最值得做的一件事。',
    uncertainties: ['演示模式未读取照片内容，以上内容不构成对这张照片的评价。'],
  };

  return {
    raw,
    providerRequestId: null,
    inputTokens: null,
    outputTokens: null,
    model: 'mock',
  };
}