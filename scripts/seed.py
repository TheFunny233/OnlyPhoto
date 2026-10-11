"""Idempotent demo data (mirrors the reference seed script)."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.db import execute, query_all, query_one, run_migrations, upload_dir  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.utils import dumps, new_id, now_ms  # noqa: E402

STATIC_DEMO = Path(__file__).resolve().parent.parent / "app" / "static" / "demo"

DEMO_USERS = [
    {"id": "demo-user-a", "email": "demo.a@photomaster.local", "nickname": "演示用户 A", "password": "demo12345"},
    {"id": "demo-user-b", "email": "demo.b@photomaster.local", "nickname": "演示用户 B", "password": "demo12345"},
]

DEMO_SPOTS = [
    ("demo-spot-1", "外滩亲水平台·对岸天际线", "上海", "黄浦区·外滩", 31.2401, 121.4902, ["建筑", "夜景", "日出日落"],
     "以对岸天际线为主体，适合练习地平线与主体取舍。", "站在亲水平台靠护栏一侧，面向对岸；稍微向左移动，让路灯避开主体轮廓。",
     "朝东北", "傍晚蓝调时段（作者经验，具体时段未核实）", "author_experience", "等效 24-35mm", "公共区域，注意人流与护栏，不要翻越围栏。", "city-skyline.jpg"),
    ("demo-spot-2", "老街骑楼·雨后人像", "广州", "荔湾区·老街", 23.1168, 113.2397, ["人像", "街拍", "人文"],
     "利用骑楼顶棚的柔光拍摄人像，注意背景招牌不要压过人物。", "让被摄者站在骑楼下避光处，拍摄者后退两步，用招牌作为背景但避免与头部重叠。",
     "朝向骑楼内侧", "阴天或雨后（外部资料，尚未核实）", "external", "", "尊重商户与居民，拍摄前先征求同意。", "street-portrait.jpg"),
    ("demo-spot-3", "城市公园湖畔·倒影构图", "杭州", "西湖区·湖畔", 30.2465, 120.1492, ["风景", "日出日落"],
     "贴近水面拍摄倒影，利用对称构图强化层次。", "站在湖边安全区域，蹲低让镜头贴近水面，保持地平线水平。",
     "朝西", "清晨（条件性建议）", "author_experience", "", "注意水边安全，不要越过警示线。", "lake-reflection.jpg"),
    ("demo-spot-4", "古镇石桥·晨雾", "苏州", "平江路一带", 31.3135, 120.6298, ["风景", "人文"],
     "以石桥为前景，等待行人经过形成对比。", "站在桥的一端，沿河道方向拍摄，让桥拱框住远景。",
     "沿河道逆光方向", "清晨薄雾（未核实）", "unconfirmed", "", "桥面狭窄，注意来往行人。", "old-town-bridge.jpg"),
    ("demo-spot-5", "夜市小吃摊·美食特写", "成都", "锦江区·夜市", 30.6571, 104.0816, ["美食", "街拍"],
     "用摊位灯光作为主光源拍摄食物特写。", "从摊位侧前方拍摄，让暖光从侧上方向下，避免自己的阴影挡住食物。",
     "侧前方", "夜间摊位灯光（作者经验）", "author_experience", "", "注意烟火与热油，先征得摊主同意。", "night-market.jpg"),
    ("demo-spot-6", "海湾栈道·长曝海景", "厦门", "环岛路·栈道", 24.4388, 118.1089, ["风景", "日出日落"],
     "以栈道引导线指向海平面，适合练习水平线。", "站在栈道起点，让栏杆形成引导线，保持地平线水平。",
     "朝东南", "日出前后（条件性建议）", "unconfirmed", "三脚架有助于稳定", "海风较大，注意脚下与设备安全。", "coast-boardwalk.jpg"),
    ("demo-spot-7", "高楼观景台·城市俯瞰", "重庆", "渝中区·观景平台", 29.5630, 106.5516, ["建筑", "夜景"],
     "透过观景台玻璃拍摄夜景，注意玻璃反光。", "把镜头贴近玻璃，用手或衣角遮挡周围反光，避免拍到室内灯光倒影。",
     "朝向江面", "入夜后灯光亮起（作者经验）", "author_experience", "", "遵守观景台规定，不要攀爬护栏。", "city-observation.jpg"),
    ("demo-spot-8", "山间步道·云海远眺", "黄山", "风景区步道", 30.1319, 118.1669, ["风景"],
     "以近处松树为前景，拍摄远处云海层次。", "站在步道内侧安全处，用前景枝条作为画框，避免遮挡远山主体。",
     "朝向云海方向", "清晨云海（未核实）", "unconfirmed", "中长焦有助于压缩层次", "山区天气多变，注意保暖与防滑，不进入未开放区域。", "mountain-mist.jpg"),
]


def seed_users() -> None:
    for user in DEMO_USERS:
        if query_one("SELECT 1 FROM users WHERE email = ?", (user["email"],)) is None:
            execute(
                "INSERT INTO users (id, email, password_hash, nickname, is_demo, created_at) VALUES (?, ?, ?, ?, 1, ?)",
                (user["id"], user["email"], hash_password(user["password"]), user["nickname"], now_ms()),
            )
            print(f"[seed] created demo user {user['email']}")


def seed_spots() -> None:
    owner = DEMO_USERS[0]["id"]
    for row in DEMO_SPOTS:
        (spot_id, title, city, area, lat, lng, subjects, description, how, direction, light, source, gear, safety, image) = row
        if query_one("SELECT 1 FROM spots WHERE id = ?", (spot_id,)) is not None:
            continue
        now = now_ms()
        execute(
            """
            INSERT INTO spots (id, owner_id, title, city, area, lat, lng, coord_system, precision, subjects,
                               description, how_to_stand, direction, best_light, light_source, gear, safety,
                               status, is_demo, verified_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'WGS84', 'approximate', ?, ?, ?, ?, ?, ?, ?, ?, 'published', 1, ?, ?, ?)
            """,
            (spot_id, owner, title, city, area, lat, lng, dumps(subjects),
             f"{description}（机位数据演示 / 配图非此地实拍）", how, direction, light, source, gear, safety, now, now, now),
        )
        source_path = STATIC_DEMO / image
        if source_path.exists():
            target_key = f"public/demo/{image}"
            target = upload_dir() / "public" / "demo" / image
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source_path, target)
            execute(
                """
                INSERT INTO spot_media (id, spot_id, owner_id, photo_id, storage_key, width, height, bytes, sort, is_demo, created_at)
                VALUES (?, ?, ?, NULL, ?, 1200, 800, ?, 0, 1, ?)
                """,
                (new_id(), spot_id, owner, target_key, target.stat().st_size, now),
            )
        print(f"[seed] created demo spot {spot_id}")


def seed_interactions() -> None:
    other = DEMO_USERS[1]["id"]
    for row in DEMO_SPOTS[:3]:
        spot_id = row[0]
        if query_one("SELECT 1 FROM likes WHERE spot_id = ? AND user_id = ?", (spot_id, other)) is None:
            execute("INSERT INTO likes (user_id, spot_id, created_at) VALUES (?, ?, ?)", (other, spot_id, now_ms()))
        if not query_all("SELECT 1 FROM comments WHERE spot_id = ?", (spot_id,)):
            execute(
                "INSERT INTO comments (id, spot_id, user_id, body, status, created_at) VALUES (?, ?, ?, ?, 'visible', ?)",
                (new_id(), spot_id, other, "演示评论：这个角度不错，下次试试在蓝调时段来。", now_ms()),
            )


def main() -> None:
    run_migrations()
    if not settings.demo_mode:
        print("[seed] APP_DEMO_MODE=false，跳过演示数据。")
        return
    seed_users()
    seed_spots()
    seed_interactions()
    print("[seed] 演示数据准备完成（幂等，可重复执行）。")


if __name__ == "__main__":
    main()