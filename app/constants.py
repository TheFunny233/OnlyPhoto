from __future__ import annotations

SCENE_OPTIONS = [
    {"value": "auto", "label": "自动判断"},
    {"value": "portrait", "label": "人像"},
    {"value": "landscape", "label": "风景"},
    {"value": "architecture", "label": "建筑"},
    {"value": "street", "label": "街拍"},
    {"value": "food", "label": "美食"},
]

GOAL_OPTIONS = [
    {"value": "highlight_subject", "label": "更突出主体"},
    {"value": "keep_documentary", "label": "保留纪实感"},
    {"value": "improve_color", "label": "改善色彩"},
    {"value": "brighter", "label": "整体更明亮"},
    {"value": "cleaner_background", "label": "背景更干净"},
    {"value": "stronger_contrast", "label": "加强层次对比"},
]

SUBJECT_OPTIONS = ["人像", "风景", "建筑", "街拍", "美食", "日出日落", "夜景", "人文"]

LIGHT_SOURCE_LABEL = {
    "author_experience": "作者经验",
    "external": "外部资料",
    "unconfirmed": "尚未确认",
}

PRECISION_LABEL = {"exact": "精确位置", "approximate": "大致位置"}

CATEGORY_LABEL = {
    "composition": "构图",
    "light": "光线",
    "color": "色彩",
    "subject": "主体",
    "background": "背景",
    "other": "其他",
}

PRIORITY_LABEL = {"high": "优先级高", "medium": "优先级中", "low": "优先级低"}
PRIORITY_TONE = {"high": "danger", "medium": "warn", "low": "neutral"}

APP_TAGLINE = "看懂这张照片，拍好下一张。"

SCENE_VALUES = {item["value"] for item in SCENE_OPTIONS}
GOAL_VALUES = {item["value"] for item in GOAL_OPTIONS}


def scene_label(value: str) -> str:
    for item in SCENE_OPTIONS:
        if item["value"] == value:
            return item["label"]
    return value


def goal_label(value: str) -> str:
    for item in GOAL_OPTIONS:
        if item["value"] == value:
            return item["label"]
    return value