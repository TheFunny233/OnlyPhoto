from __future__ import annotations

import io
import time
from pathlib import Path

import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
TMP = ROOT / "artifacts" / "test-results" / "tmp"


def make_jpeg(width: int = 640, height: int = 480) -> Path:
    TMP.mkdir(parents=True, exist_ok=True)
    target = TMP / f"e2e-{int(time.time() * 1000)}.jpg"
    image = Image.new("RGB", (width, height))
    pixels = image.load()
    for x in range(width):
        for y in range(height):
            pixels[x, y] = (int(x / width * 200) + 20, int(y / height * 160) + 40, 120)
    image.save(target, format="JPEG", quality=90)
    return target


def register(page, base, email, nickname, password):
    page.goto(base + "/register")
    page.get_by_label("昵称").fill(nickname)
    page.get_by_label("邮箱").fill(email)
    page.get_by_label("密码").fill(password)
    page.get_by_test_id("register-submit").click()
    page.wait_for_url("**/studio")


def test_register_login_refresh_logout(browser_page, base_url):
    page = browser_page
    stamp = int(time.time() * 1000)
    email = f"e2e.{stamp}@example.com"
    register(page, base_url, email, "端到端用户", "testpass123")

    assert "端到端用户" in page.get_by_test_id("nav-me").inner_text()
    page.reload()
    assert "端到端用户" in page.get_by_test_id("nav-me").inner_text()

    page.goto(base_url + "/settings")
    page.get_by_test_id("logout-button").click()
    page.wait_for_url(base_url + "/")
    page.goto(base_url + "/studio")
    assert "登录后开始分析你的照片" in page.locator("body").inner_text()


def test_upload_analyze_edit_export(browser_page, base_url):
    page = browser_page
    stamp = int(time.time() * 1000)
    email = f"flow.{stamp}@example.com"
    register(page, base_url, email, "流程用户", "testpass123")

    image_path = make_jpeg()
    original_bytes = image_path.read_bytes()

    page.goto(base_url + "/studio")
    with page.expect_file_chooser() as chooser_info:
        page.get_by_role("button", name="选择图片").click()
    chooser_info.value.set_files(str(image_path))
    page.get_by_test_id("consent-checkbox").check()
    page.get_by_test_id("confirm-upload").click()
    page.wait_for_url("**/studio/*")

    page.get_by_test_id("start-analysis").click()
    page.get_by_text("先做这一件事").wait_for(timeout=30000)
    for tab in ["优点", "可改进处", "重拍建议", "修图建议"]:
        assert page.get_by_role("tab", name=tab).is_visible()
    # Demo mode must not fabricate a score: the UI explains scoring needs a real model.
    assert page.get_by_test_id("score-unavailable").is_visible()
    assert page.get_by_test_id("score-card").count() == 0

    page.get_by_test_id("toggle-edit").click()
    page.get_by_test_id("slider-exposure").fill("0.6")
    page.get_by_test_id("slider-contrast").fill("15")
    with page.expect_download() as download_info:
        page.get_by_test_id("export-jpeg").click()
    download = download_info.value
    exported = download.path().read_bytes()
    assert len(exported) > 0
    assert exported != original_bytes

    page.get_by_test_id("save-recipe").click()
    page.get_by_test_id("reset-recipe").click()


def test_publish_and_community(browser_page, base_url):
    page = browser_page
    stamp = int(time.time() * 1000)
    email = f"pub.{stamp}@example.com"
    register(page, base_url, email, "发布用户", "testpass123")

    page.goto(base_url + "/publish")
    page.get_by_label("城市").fill("测试市")
    page.locator("#publish-map").click(position={"x": 200, "y": 150})
    page.get_by_role("button", name="下一步").click()
    page.get_by_role("button", name="下一步").click()
    page.get_by_label("机位标题").fill(f"端到端机位 {stamp}")
    page.get_by_role("button", name="建筑").click()
    page.get_by_role("button", name="下一步").click()
    page.get_by_test_id("publish-confirm").check()
    page.get_by_test_id("publish-submit").click()
    page.wait_for_url("**/spots/*")

    url = page.url
    assert "/spots/" in url
    assert page.get_by_role("heading", level=1).inner_text().startswith("端到端机位")

    page.get_by_test_id("comment-input").fill("这是端到端测试评论。")
    page.get_by_test_id("comment-submit").click()
    # The author's own comment also renders an inline edit box, so scope to the paragraph.
    comment = page.get_by_test_id("comment-list").locator("p", has_text="这是端到端测试评论。").first
    comment.wait_for()
    page.reload()
    assert page.get_by_test_id("comment-list").locator("p", has_text="这是端到端测试评论。").first.is_visible()

    page.get_by_test_id("like-button").click()
    assert "已赞" in page.get_by_test_id("like-button").inner_text()


def test_xss_is_not_executed(browser_page, base_url):
    page = browser_page
    stamp = int(time.time() * 1000)
    email = f"xss.{stamp}@example.com"
    register(page, base_url, email, "安全用户", "testpass123")

    page.goto(base_url + "/publish")
    page.get_by_label("城市").fill("测试市")
    page.locator("#publish-map").click(position={"x": 200, "y": 150})
    page.get_by_role("button", name="下一步").click()
    page.get_by_role("button", name="下一步").click()
    page.get_by_label("机位标题").fill("XSS 机位")
    page.get_by_role("button", name="下一步").click()
    page.get_by_test_id("publish-confirm").check()
    page.get_by_test_id("publish-submit").click()
    page.wait_for_url("**/spots/*")

    payload = '<script>window.__xss=1</script><img src=x onerror="window.__xss=2">'
    page.get_by_test_id("comment-input").fill(payload)
    page.get_by_test_id("comment-submit").click()
    page.get_by_test_id("comment-list").locator("p", has_text="<script>").first.wait_for()
    assert page.evaluate("() => window.__xss || 0") == 0

@pytest.mark.parametrize("image_size, viewport_height", [((720, 960), 900), ((960, 720), 600)])
def test_preview_column_scrolls_under_pointer(browser_page, base_url, image_size, viewport_height):
    page = browser_page
    page.set_viewport_size({"width": 1440, "height": viewport_height})
    register(page, base_url, f"scroll.{time.time_ns()}@example.com", "滚动用户", "testpass123")
    with page.expect_file_chooser() as chooser_info:
        page.get_by_role("button", name="选择图片").click()
    chooser_info.value.set_files(str(make_jpeg(*image_size)))
    page.get_by_test_id("consent-checkbox").check()
    page.get_by_test_id("confirm-upload").click()
    page.wait_for_url("**/studio/*")
    page.get_by_test_id("start-analysis").click()
    page.get_by_text("先做这一件事").wait_for(timeout=30000)
    page.get_by_test_id("toggle-edit").click()
    page.wait_for_function("document.querySelector('#edit-canvas').width > 300")
    left = page.locator("#view-panel").locator("..").locator("..")
    assert left.evaluate("el => el.getBoundingClientRect().bottom") <= viewport_height
    left.evaluate("el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 80)")
    box = left.bounding_box()
    before = page.evaluate("window.scrollY")
    page.mouse.move(box["x"] + 100, 240)
    page.mouse.wheel(0, 450)
    page.wait_for_timeout(350)
    assert left.evaluate("el => el.scrollTop") > 100, "Wheel over preview must scroll its own controls"
    assert abs(page.evaluate("window.scrollY") - before) < 2

    # The bottom boundary must not hand the wheel over to the commentary column.
    left.evaluate("el => el.scrollTop = el.scrollHeight")
    page.mouse.wheel(0, 500)
    page.wait_for_timeout(350)
    assert abs(page.evaluate("window.scrollY") - before) < 2
    export_box = page.get_by_test_id("export-jpeg").bounding_box()
    assert 56 <= export_box["y"] < viewport_height

    # Wheels on the right still scroll the page without changing the left offset.
    offset = left.evaluate("el => el.scrollTop")
    page.mouse.move(box["x"] + box["width"] + 100, 240)
    page.mouse.wheel(0, 300)
    page.wait_for_timeout(350)
    assert page.evaluate("window.scrollY") > before + 50
    assert left.evaluate("el => el.scrollTop") == offset

    # Mobile returns to one continuous page, with all controls reachable.
    page.set_viewport_size({"width": 390, "height": 844})
    assert left.evaluate("el => getComputedStyle(el).overflowY") == "visible"
    assert left.evaluate("el => getComputedStyle(el).position") == "static"
    page.get_by_test_id("export-jpeg").scroll_into_view_if_needed()
    assert page.get_by_test_id("export-jpeg").is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
