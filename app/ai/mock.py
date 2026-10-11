from __future__ import annotations

from typing import Any

from ..constants import scene_label

DEMO_SAMPLE_HASHES: dict[str, dict[str, str]] = {}


def mock_analysis(scene: str, goals: list[str], image_hash: str) -> dict[str, Any]:
    """Deterministic mock provider. Never claims to have inspected arbitrary pixels."""
    known = DEMO_SAMPLE_HASHES.get(image_hash)
    scene_text = scene_label(scene) if scene and scene != "auto" else "场景（自动）"
    goals_text = f"结合你选择的目标（{len(goals)} 项）" if goals else "在未指定目标的情况下"

    if known:
        summary = known["summary"]
        first_action = known["firstAction"]
    else:
        summary = "演示模式：这是结构示例，并未真实识别这张照片的内容。真实点评需要配置视觉模型后开启 live 模式。"
        first_action = "先配置真实视觉模型，再根据实际画面决定最值得做的一件事。"

    raw = {
        "schemaVersion": "1",
        "scene": scene_text,
        "summary": summary,
        "strengths": [
            {
                "category": "composition",
                "title": "演示：示例优点",
                "observation": "示例文本，不代表对当前这张照片的实际判断。",
                "explanation": "演示模式用于展示结果版式与分析流程。",
                "action": "配置 AI_MODE=live 并填写视觉模型后重新分析。",
                "priority": "medium",
                "certainty": "tentative",
                "region": None,
                "requiresReshoot": False,
            }
        ],
        "improvements": [
            {
                "category": "light",
                "title": "演示：示例可改进处",
                "observation": "示例文本，未对图像做真实判断。",
                "explanation": "真实模式下会依据画面现象给出影响与优先级。",
                "action": "在真实模式下重新分析以获得针对性建议。",
                "priority": "low",
                "certainty": "tentative",
                "region": None,
                "requiresReshoot": False,
            }
        ],
        "reshootSuggestions": [f"{goals_text}，真实模式下会给出可尝试的站位、方向与光线条件。"],
        "editingSuggestions": ["演示模式不提供针对当前照片的具体修图参数。"],
        "recommendedRecipe": None,
        "firstAction": first_action,
        "uncertainties": ["演示模式未读取照片内容，以上内容不构成对这张照片的评价。"],
        # Demo mode deliberately provides no score: a number would look objective even though
        # the pixels were never inspected. The UI explains how to enable real scoring.
        "score": None,
    }

    return {
        "raw": raw,
        "provider_request_id": None,
        "input_tokens": None,
        "output_tokens": None,
        "model": "mock",
    }