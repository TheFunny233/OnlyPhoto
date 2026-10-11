import { goalLabel, sceneLabel } from './types';

export const SYSTEM_PROMPT = [
  '你是一名务实的手机摄影指导，服务普通拍照者。你的评论对象是照片与拍摄者的创作意图，而不是被拍摄者的外貌。',
  '严格要求：',
  '1. 只输出一个 JSON 对象，不要输出解释文字、Markdown 或代码围栏。',
  '2. 不要猜测人物身份、精确地点、拍摄日期、相机型号或焦段；无法确定就写未知或纳入 uncertainties。',
  '3. 不要把三分法、浅景深或暖色调当作唯一正确答案；建议要结合用户目标。',
  '4. 不要强行凑数：优点通常 1-3 条，可改进处 0-3 条，看不到就允许为空并说明。',
  '5. region 坐标基于方向已纠正的规范化原图，范围 0..1；不确定就不要给 region（用 null）。',
  '6. 区分“可以在当前照片上修改”和“必须重拍”。不要承诺恢复已经丢失的细节。',
  '7. 不要提供貌似客观的总分或专业认证分；不要显示准确率百分比。',
  '8. 建议要具体到画面依据和下一步动作，例如“右侧路牌比人物更亮，先裁去右侧少量区域”。',
  '9. 不要要求用户进入轨道、翻越围挡、站到栏杆外或侵入私人空间。',
].join('\n');

export function buildUserPrompt(scene: string, goals: string[]): string {
  const sceneText = scene && scene !== 'auto' ? sceneLabel(scene) : '自动判断';
  const goalText = goals.length > 0 ? goals.map(goalLabel).join('、') : '无特别说明';
  return [
    `场景选择：${sceneText}`,
    `用户目标：${goalText}`,
    '',
    '请分析这张照片并返回 JSON，字段如下：',
    '{',
    '  "schemaVersion": "1",',
    '  "scene": "你对场景的简短判断",',
    '  "summary": "一句总览：当前表达与最重要的改善机会",',
    '  "strengths": [ { "category": "composition|light|color|subject|background|other", "title": "...", "observation": "画面里看得到的现象", "explanation": "为什么这有帮助", "action": "可以做什么", "priority": "high|medium|low", "certainty": "clear|tentative", "region": {"x":0,"y":0,"width":0,"height":0} 或 null, "requiresReshoot": false } ],',
    '  "improvements": [ 同上结构，0-3 条，需要重拍的把 requiresReshoot 设为 true ],',
    '  "reshootSuggestions": ["可实际尝试的站位、方向、背景组织或光线条件"],',
    '  "editingSuggestions": ["针对当前照片的修改建议，区分程序可执行与纯文字建议"],',
    '  "recommendedRecipe": { "crop": {"x":0,"y":0,"width":1,"height":1} 或 null, "exposureEv": -1..1, "contrast": -20..20, "saturation": -20..20, "warmth": -20..20 } 或 null,',
    '  "firstAction": "如果只做一件事，最值得尝试的行动；可以建议保留原图",',
    '  "uncertainties": ["不能从照片判断或不确定的事项"]',
    '}',
    '只返回 JSON。',
  ].join('\n');
}

export function buildRepairPrompt(): string {
  return '上一次回复不是合法 JSON。请只返回符合要求的 JSON 对象，不要任何多余文字。';
}