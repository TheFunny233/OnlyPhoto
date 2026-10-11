from __future__ import annotations

from ..constants import goal_label, scene_label

SYSTEM_PROMPT = "\n".join(
    [
        "你是一名务实的手机摄影指导，服务普通拍照者。你的评论对象是照片与拍摄者的创作意图，而不是被拍摄者的外貌。",
        "严格要求：",
        "1. 只输出一个 JSON 对象，不要输出解释文字、Markdown 或代码围栏。",
        "2. 不要猜测人物身份、精确地点、拍摄日期、相机型号或焦段；无法确定就写未知或纳入 uncertainties。",
        "3. 不要把三分法、浅景深或暖色调当作唯一正确答案；建议要结合用户目标。",
        "4. 不要强行凑数：优点通常 1-3 条，可改进处 0-3 条，看不到就允许为空并说明。",
        "5. region 坐标基于方向已纠正的规范化原图，范围 0..1；不确定就不要给 region（用 null）。",
        "6. 区分“可以在当前照片上修改”和“必须重拍”。不要承诺恢复已经丢失的细节。",
        "7. 不要提供貌似客观的总分或专业认证分；不要显示准确率百分比。",
        "8. 建议要具体到画面依据和下一步动作，例如“右侧路牌比人物更亮，先裁去右侧少量区域”。",
        "9. 不要要求用户进入轨道、翻越围挡、站到栏杆外或侵入私人空间。",
        "10. 评分要求：给出 0-100 的分维度参考分（构图/光线/色彩/主体/背景），每个维度必须写明理由；加分项与扣分项要具体到画面依据，不夸大、不凑数。这是主观参考建议，不得表述为客观总分或专业认证。",
    ]
)


def build_user_prompt(scene: str, goals: list[str]) -> str:
    scene_text = scene_label(scene) if scene and scene != "auto" else "自动判断"
    goal_text = "、".join(goal_label(g) for g in goals) if goals else "无特别说明"
    return "\n".join(
        [
            f"场景选择：{scene_text}",
            f"用户目标：{goal_text}",
            "",
            "请分析这张照片并返回 JSON，字段如下：",
            "{",
            '  "schemaVersion": "1",',
            '  "scene": "你对场景的简短判断",',
            '  "summary": "一句总览：当前表达与最重要的改善机会",',
            '  "strengths": [ { "category": "composition|light|color|subject|background|other", "title": "...", "observation": "画面里看得到的现象", "explanation": "为什么这有帮助", "action": "可以做什么", "priority": "high|medium|low", "certainty": "clear|tentative", "region": {"x":0,"y":0,"width":0,"height":0} 或 null, "requiresReshoot": false } ],',
            "  \"improvements\": [ 同上结构，0-3 条，需要重拍的把 requiresReshoot 设为 true ],",
            '  "reshootSuggestions": ["可实际尝试的站位、方向、背景组织或光线条件"],',
            '  "editingSuggestions": ["针对当前照片的修改建议，区分程序可执行与纯文字建议"],',
            '  "recommendedRecipe": { "crop": {"x":0,"y":0,"width":1,"height":1} 或 null, "exposureEv": -1..1, "contrast": -20..20, "saturation": -20..20, "warmth": -20..20 } 或 null,',
            '  "firstAction": "如果只做一件事，最值得尝试的行动；可以建议保留原图",',
            '  "uncertainties": ["不能从照片判断或不确定的事项"],',
            '  "score": {',
            '    "summary": "一句话解释这个分数是怎么来的",',
            '    "dimensions": [ { "key": "composition|light|color|subject|background", "score": 0-100, "reason": "该维度的评分依据" } ],',
            '    "pros": [ { "label": "加分项名称", "delta": 正数, "reason": "具体依据" } ],',
            '    "cons": [ { "label": "扣分项名称", "delta": 负数, "reason": "具体依据" } ]',
            "  }",
            "}",
            "只返回 JSON。",
        ]
    )


def build_repair_prompt() -> str:
    return "上一次回复不是合法 JSON。请只返回符合要求的 JSON 对象，不要任何多余文字。"