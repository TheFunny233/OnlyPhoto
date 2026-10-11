export type FindingCategory =
  | 'composition'
  | 'light'
  | 'color'
  | 'subject'
  | 'background'
  | 'other';

export type Priority = 'high' | 'medium' | 'low';
export type Certainty = 'clear' | 'tentative';

export type EvidenceRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PhotoFinding = {
  id: string;
  category: FindingCategory;
  title: string;
  observation: string;
  explanation: string;
  action: string;
  priority: Priority;
  certainty: Certainty;
  region: EvidenceRegion | null;
  requiresReshoot: boolean;
};

export type EditRecipe = {
  crop: EvidenceRegion | null;
  exposureEv: number;
  contrast: number;
  saturation: number;
  warmth: number;
};

export type PhotoAnalysis = {
  schemaVersion: '1';
  scene: string;
  summary: string;
  strengths: PhotoFinding[];
  improvements: PhotoFinding[];
  reshootSuggestions: string[];
  editingSuggestions: string[];
  recommendedRecipe: EditRecipe | null;
  firstAction: string;
  uncertainties: string[];
};

export type AnalysisReceipt = {
  mode: 'live' | 'mock';
  provider: string;
  model: string | null;
  promptVersion: string;
  providerRequestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  imageHash: string;
  generatedAt: string;
};

export type AnalysisState = 'queued' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export const SCENE_OPTIONS = [
  { value: 'auto', label: '自动判断' },
  { value: 'portrait', label: '人像' },
  { value: 'landscape', label: '风景' },
  { value: 'architecture', label: '建筑' },
  { value: 'street', label: '街拍' },
  { value: 'food', label: '美食' },
] as const;

export const GOAL_OPTIONS = [
  { value: 'highlight_subject', label: '更突出主体' },
  { value: 'keep_documentary', label: '保留纪实感' },
  { value: 'improve_color', label: '改善色彩' },
  { value: 'brighter', label: '整体更明亮' },
  { value: 'cleaner_background', label: '背景更干净' },
  { value: 'stronger_contrast', label: '加强层次对比' },
] as const;

export type SceneValue = (typeof SCENE_OPTIONS)[number]['value'];
export type GoalValue = (typeof GOAL_OPTIONS)[number]['value'];

export function sceneLabel(value: string): string {
  return SCENE_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

export function goalLabel(value: string): string {
  return GOAL_OPTIONS.find((g) => g.value === value)?.label ?? value;
}