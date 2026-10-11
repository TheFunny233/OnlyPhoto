"""Template rendering guards.

A missing Jinja filter/global (e.g. `goal_label`) used to blow up the whole
workbench page whenever a real analysis had non-empty goals. These tests render
the key templates directly so such regressions fail fast without a browser.
"""

from __future__ import annotations

from app.templating import templates


def render(name: str, context: dict) -> str:
    return templates.get_template(name).render(context)


BASE_USER = {"id": "u1", "nickname": "渲染用户", "email": "render@example.com", "is_demo": False}


def analysis_with_score():
    return {
        "schemaVersion": "1",
        "scene": "landscape",
        "summary": "总览文本",
        "strengths": [
            {
                "id": "f1",
                "category": "composition",
                "title": "优点标题",
                "observation": "观察",
                "explanation": "解释",
                "action": "行动",
                "priority": "high",
                "certainty": "clear",
                "region": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2},
                "requiresReshoot": False,
            }
        ],
        "improvements": [
            {
                "id": "f11",
                "category": "color",
                "title": "问题标题",
                "observation": "观察",
                "explanation": "解释",
                "action": "行动",
                "priority": "medium",
                "certainty": "tentative",
                "region": None,
                "requiresReshoot": True,
            }
        ],
        "reshootSuggestions": ["重拍建议"],
        "editingSuggestions": ["修图建议"],
        "recommendedRecipe": {"crop": None, "exposureEv": 0.2, "contrast": 5, "saturation": 0, "warmth": 3},
        "firstAction": "先做这件事",
        "uncertainties": ["不确定项"],
        "score": {
            "overall": 68,
            "scale": "0-100（主观参考分，非专业认证）",
            "summary": "分数来源",
            "dimensions": [
                {"key": "composition", "label": "构图", "score": 70, "weight": 0.25, "reason": "理由"},
                {"key": "light", "label": "光线", "score": 60, "weight": 0.25, "reason": "理由"},
            ],
            "pros": [{"label": "加分项", "delta": 5, "reason": "理由"}],
            "cons": [{"label": "扣分项", "delta": -4, "reason": "理由"}],
        },
    }


def test_workbench_renders_with_goals_and_score():
    detail = {
        "photo": {
            "id": "p1",
            "originalName": "a.jpg",
            "mimeType": "image/jpeg",
            "width": 1200,
            "height": 800,
            "bytes": 1234,
            "privacy": "private",
            "createdAt": "2026-01-01T00:00:00+00:00",
            "analysisStatus": "succeeded",
            "mediaUrl": "/api/photos/p1/media",
            "thumbUrl": "/api/photos/p1/media?thumb=1",
        },
        "analysis": analysis_with_score(),
        "receipt": {
            "mode": "live",
            "provider": "example.com",
            "model": "vision-model",
            "promptVersion": "pm-analysis-v1",
            "providerRequestId": "req-1",
            "inputTokens": 100,
            "outputTokens": 200,
            "imageHash": "hash",
            "generatedAt": "2026-01-01T00:00:00+00:00",
        },
        "jobId": "j1",
        # Non-empty goals is exactly the case that used to raise "No filter named 'goal_label'".
        "analysisMeta": {"scene": "landscape", "goals": ["improve_color", "brighter"]},
        "recipe": None,
    }
    html = render(
        "workbench.html",
        {
            "user": BASE_USER,
            "active": "studio",
            "detail": detail,
            "photo_id": "p1",
            "not_found": False,
            "scene_options": [{"value": "auto", "label": "自动判断"}],
            "goal_options": [{"value": "improve_color", "label": "改善色彩"}],
            "category_label": {"color": "色彩", "composition": "构图"},
            "priority_label": {"high": "优先级高", "medium": "优先级中"},
            "priority_tone": {"high": "danger", "medium": "warn"},
        },
    )
    assert "本次评分基于" in html
    assert "改善色彩" in html and "整体更明亮" in html  # goals rendered via filters
    assert "score-context" in html
    assert "score-radar" in html
    assert "score-overall" in html


def test_workbench_renders_without_analysis_or_score():
    photo = {
        "id": "p2",
        "originalName": "b.jpg",
        "mimeType": "image/jpeg",
        "width": 800,
        "height": 600,
        "bytes": 1000,
        "privacy": "private",
        "createdAt": "2026-01-01T00:00:00+00:00",
        "analysisStatus": "none",
        "mediaUrl": "/api/photos/p2/media",
        "thumbUrl": "/api/photos/p2/media?thumb=1",
    }
    html = render(
        "workbench.html",
        {
            "user": BASE_USER,
            "active": "studio",
            "detail": {"photo": photo, "analysis": None, "receipt": None, "jobId": None, "analysisMeta": None, "recipe": None},
            "photo_id": "p2",
            "not_found": False,
            "scene_options": [{"value": "auto", "label": "自动判断"}],
            "goal_options": [{"value": "brighter", "label": "整体更明亮"}],
            "category_label": {},
            "priority_label": {},
            "priority_tone": {},
        },
    )
    assert "start-analysis" in html
    assert "score-card" not in html


def test_explore_renders_with_topics_and_filters():
    html = render(
        "explore.html",
        {
            "user": None,
            "active": "explore",
            "spots": [],
            "total": 0,
            "has_more": False,
            "cities": ["上海"],
            "subjects": ["风景"],
            "filters": {"city": "", "subject": "", "q": "", "author": "", "sort": "latest", "favorites": False, "near": False, "feed": ""},
            "following_count": 0,
            "topics": [{"subject": "风景", "count": 2, "hot": 9, "cityCount": 1, "coverUrl": None}],
            "recommended": [],
        },
    )
    assert "热门话题" in html
    assert "filter-sort" in html
    assert "near_hot" in html