"""Photography academy content.

This is the platform's own course catalogue rendered by Jinja. Courses are shown with
covers, outlines and prices; there is intentionally **no checkout/payment flow**, so no
button pretends to purchase anything. Course actions lead to real pages (course detail,
workbench, scoring guide).
"""

from __future__ import annotations

from typing import Any

# Covers reuse images already shipped with the project (app/static/demo/*).
COURSES: list[dict[str, Any]] = [
    {
        "slug": "phone-basics",
        "title": "手机摄影入门：光线、构图与对焦",
        "subtitle": "从随手拍走向有意识的取景",
        "level": "入门",
        "lessons": 4,
        "duration": "约 45 分钟",
        "instructor": "PhotoMaster 摄影组",
        "free": True,
        "price": None,
        "cover": "hero.jpg",
        "tags": ["手机摄影", "基础"],
        "summary": "用手机也能拍的稳、看得清：先学会判断光线方向，再解决对焦与水平线，最后把主体放到更合适的位置。",
        "outline": [
            "第 1 课 看清光线方向：顺光、侧光与逆光的取舍",
            "第 2 课 对焦与曝光：点按对焦、锁定曝光的常用手法",
            "第 3 课 构图起步：水平线、留白与主体位置",
            "第 4 课 一次外拍的完整流程与自查清单",
        ],
        "for_who": "刚开始用手机认真拍照、希望少走弯路的同学。",
        "outcomes": ["能判断现场光线是否适合拍摄", "会用最简单的方式保证主体清晰", "拍完能做一次快速自查"],
    },
    {
        "slug": "composition-beyond-rule",
        "title": "构图基础：三分法之外",
        "subtitle": "让画面有秩序，而不是套公式",
        "level": "入门",
        "lessons": 3,
        "duration": "约 40 分钟",
        "instructor": "PhotoMaster 摄影组",
        "free": True,
        "price": None,
        "cover": "lake-reflection.jpg",
        "tags": ["构图", "基础"],
        "summary": "三分法只是起点。本课用对称、重复、框架与引导线四类结构，帮你在现场快速找到画面秩序。",
        "outline": [
            "第 1 课 三分法什么时候不该用",
            "第 2 课 对称、重复与框架：三种稳定的结构",
            "第 3 课 引导线与前景：把视线带到主体",
        ],
        "for_who": "会按快门、但画面常显得杂乱的同学。",
        "outcomes": ["能在现场识别可用的结构", "知道何时该打破三分法", "用前景与引导线强化主体"],
    },
    {
        "slug": "natural-light-portrait",
        "title": "利用自然光拍人像",
        "subtitle": "不靠器材，先把光用对",
        "level": "入门",
        "lessons": 4,
        "duration": "约 50 分钟",
        "instructor": "PhotoMaster 摄影组",
        "free": True,
        "price": None,
        "cover": "street-portrait.jpg",
        "tags": ["人像", "光线"],
        "summary": "从窗户光到室外阴影，学会找到柔和的过渡光，避免脸上出现难看的阴影与油光。",
        "outline": [
            "第 1 课 找光的三个位置：窗边、檐下、阴影",
            "第 2 课 避开顶光：中午也能拍人像",
            "第 3 课 背景与人物的分离",
            "第 4 课 让被拍者放松的沟通方式",
        ],
        "for_who": "想给家人朋友拍出自然照片的同学。",
        "outcomes": ["能快速判断可用光位", "减少脸上硬阴影", "用背景衬托人物"],
    },
    {
        "slug": "edit-basics",
        "title": "后期起步：曝光、白平衡与裁剪",
        "subtitle": "三个滑块解决大部分问题",
        "level": "入门",
        "lessons": 3,
        "duration": "约 35 分钟",
        "instructor": "PhotoMaster 摄影组",
        "free": True,
        "price": None,
        "cover": "old-town-bridge.jpg",
        "tags": ["后期", "基础"],
        "summary": "先校正，再表达：用曝光、白平衡与裁剪把照片拉回正常，而不是堆滤镜。",
        "outline": [
            "第 1 课 曝光与暗部：避免死黑与死白",
            "第 2 课 白平衡：让颜色回到自然",
            "第 3 课 裁剪与水平线：最快提升观感的一步",
        ],
        "for_who": "拍得不错但成片总感觉“差点意思”的同学。",
        "outcomes": ["知道先调什么后调什么", "能判断白平衡是否偏移", "用裁剪改善画面重点"],
    },
    {
        "slug": "city-night",
        "title": "城市夜景实战",
        "subtitle": "车流、灯光与倒影的拍摄思路",
        "level": "进阶",
        "lessons": 6,
        "duration": "约 90 分钟",
        "instructor": "PhotoMaster 摄影组",
        "free": False,
        "price": 99,
        "cover": "city-observation.jpg",
        "tags": ["夜景", "城市", "外拍"],
        "summary": "从机位选择到长曝参数，完整走一遍夜景拍摄：如何找倒影、避开杂乱灯光、控制高光溢出。",
        "outline": [
            "第 1 课 夜景机位：哪里能找到干净的背景",
            "第 2 课 稳定为先：手持与支撑的取舍",
            "第 3 课 车流与光轨：时间与时机",
            "第 4 课 高光控制：霓虹不过曝",
            "第 5 课 水面倒影的取景",
            "第 6 课 夜景后期：降噪与色彩",
        ],
        "for_who": "已经会基础操作、想认真拍一次夜景的同学。",
        "outcomes": ["能独立选择夜景机位", "掌握长曝的基本参数区间", "控制夜景高光与色偏"],
    },
    {
        "slug": "street-observation",
        "title": "街头摄影的观察与等待",
        "subtitle": "在熟悉的街口拍出不一样的画面",
        "level": "进阶",
        "lessons": 5,
        "duration": "约 75 分钟",
        "instructor": "PhotoMaster 摄影组",
        "free": False,
        "price": 129,
        "cover": "night-market.jpg",
        "tags": ["街拍", "人文"],
        "summary": "街头摄影不是碰运气：先确定背景与人流结构，再等待合适的人走进画面。",
        "outline": [
            "第 1 课 先找背景，再等主体",
            "第 2 课 光线与时段：什么时候出门",
            "第 3 课 距离与尊重：如何自然地拍摄陌生人",
            "第 4 课 一组照片的叙事组织",
            "第 5 课 街头后期：保留现场感",
        ],
        "for_who": "喜欢记录城市生活、想拍得更有结构的同学。",
        "outcomes": ["建立背景优先的观察习惯", "知道如何组织一组街拍", "把握拍摄距离与礼仪"],
    },
    {
        "slug": "landscape-layers",
        "title": "风光构图进阶：层次与引导线",
        "subtitle": "让远景不再是一张平片",
        "level": "进阶",
        "lessons": 6,
        "duration": "约 85 分钟",
        "instructor": "PhotoMaster 摄影组",
        "free": False,
        "price": 149,
        "cover": "mountain-mist.jpg",
        "tags": ["风光", "构图", "外拍"],
        "summary": "用前景、中景与远景建立层次，配合引导线与天气条件，把风光拍出纵深。",
        "outline": [
            "第 1 课 前景的价值：不只是装饰",
            "第 2 课 三层结构：近中远的分配",
            "第 3 课 引导线与视线动线",
            "第 4 课 天气与时段的选择",
            "第 5 课 长曝与慢门的效果控制",
            "第 6 课 风光后期：还原现场氛围",
        ],
        "for_who": "常拍风光但画面偏平、缺少纵深感的同学。",
        "outcomes": ["用前景建立纵深", "合理安排画面层次", "根据天气调整拍摄计划"],
    },
    {
        "slug": "portrait-lighting-workshop",
        "title": "人像用光工作坊",
        "subtitle": "从单灯到反射板的完整练习",
        "level": "进阶",
        "lessons": 8,
        "duration": "约 120 分钟",
        "instructor": "PhotoMaster 摄影组",
        "free": False,
        "price": 299,
        "cover": "coast-boardwalk.jpg",
        "tags": ["人像", "用光", "工作坊"],
        "summary": "以练习为主线：用一个光源配合反光板与自然环境，做出柔和、有立体感的人像光线。",
        "outline": [
            "第 1 课 光源位置与五官立体感",
            "第 2 课 柔光与硬光的界线",
            "第 3 课 一灯一板的三种基础布局",
            "第 4 课 环境光与人工光的平衡",
            "第 5 课 皮肤质感与高光控制",
            "第 6 课 背景与轮廓光",
            "第 7 课 完整拍摄流程演练",
            "第 8 课 选片与人像后期",
        ],
        "for_who": "愿意投入一次系统练习、想稳定拍出好人像的同学。",
        "outcomes": ["理解光源位置对立体感的影响", "能用一灯一板完成基础布光", "独立完成一次人像拍摄与后期"],
    },
]

BY_SLUG: dict[str, dict[str, Any]] = {course["slug"]: course for course in COURSES}


def list_courses(kind: str | None = None) -> list[dict[str, Any]]:
    """kind: None | 'free' | 'paid'."""
    if kind == "free":
        return [course for course in COURSES if course["free"]]
    if kind == "paid":
        return [course for course in COURSES if not course["free"]]
    return list(COURSES)


def get_course(slug: str) -> dict[str, Any] | None:
    return BY_SLUG.get(slug)


def course_stats() -> dict[str, int]:
    return {
        "total": len(COURSES),
        "free": len([c for c in COURSES if c["free"]]),
        "paid": len([c for c in COURSES if not c["free"]]),
    }