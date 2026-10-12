# 摄影课堂（栏目说明 · 工程文档）

> 本文档是工程记录，**不会出现在网站页面上**。

## 定位

`/academy` 是 PhotoMaster 的课程栏目，展示平台自有课程，分**免费课**与**收费课**。页面目标是把“学什么、练什么”讲清楚，并与工作台、评分口径页打通。

## 页面

| 路由 | 内容 |
|---|---|
| `/academy` | 课程列表：标题与简介、统计（共 N 门 · 免费 N · 收费 N）、筛选（全部 / 免费 / 收费）、课程卡（封面、级别、免费或价格、讲师·课时·时长、标签、按钮） |
| `/academy/{slug}` | 课程详情：封面、级别与价格徽章、讲师/课时/时长/主题、简介、**你将学到**、**适合人群**、**课程大纲**、动作区、其他课程 |

按钮与去处（**均为真实可用页面，不制造“能点但没功能”的控件**）：

- 免费课程 → 「开始学习」（进入课程详情）；详情页主按钮「开始学习：去工作台练习」→ `/studio`
- 收费课程 → 「查看课程详情」；详情页主按钮「按大纲去工作台练习」→ `/studio`
- 均提供次按钮「了解评分口径」→ `/scoring-guide`

## 关于支付

**没有实现任何支付/结算流程**，因此页面上**没有**“立即购买 / 加入购物车 / 去支付”这类按钮。收费课程以价格与大纲呈现，并如实说明：

> 本课程为收费课程（¥N）。平台上暂未提供自助支付，如需开通请联系平台管理员；课程大纲与方法可直接在下方的「去工作台练习」中实践。

## 内容与图片来源

- 课程文本（标题、简介、大纲、你将学到、适合人群）由本项目编写，讲师署名为平台团队（`PhotoMaster 摄影组`），**不编造真人讲师姓名或头衔**。
- 封面复用项目内已授权的演示图片（`app/static/demo/*`，来源见 `docs/ASSET_SOURCES.md`）。
- **不展示虚构的学员人数、评分或好评**，避免制造不实的社会证明。

## 工程实现

- 数据：`app/academy.py`（`COURSES` / `list_courses(kind)` / `get_course(slug)` / `course_stats()`），无数据库依赖。
- 路由：`app/routers/pages.py` 的 `/academy` 与 `/academy/{slug}`（不存在时渲染通用提示页）。
- 模板：`app/templates/academy.html`、`app/templates/academy_course.html`。
- 导航：`NAV_LINKS` 新增「摄影课堂」（移动端显示短称「课堂」，使用项目自有媒体查询类 `.nav-long/.nav-short`，因为复用的工具类产物不含对应变体）。

## 验证

- `artifacts/test-results/academy-verify.json`（`ACADEMY_OK`）：8 张课程卡、免费/收费筛选各 4、详情页含大纲与“你将学到”、**页面无“仅供展示/演示数据”字样**、**无购买按钮**、桌面/移动/窄屏导航无重复且无横向溢出、无 4xx 资源与 JS 错误。
- 截图：`artifacts/screenshots/python/academy.png`、`academy-course.png`。
- 模板回归：`tests/integration/test_templates.py::test_academy_pages_render_without_storefront_language`（断言禁用语与无死按钮）。
- E2E 稳定性：`tests/e2e/conftest.py` 拦截外部瓦片请求，避免页面加载依赖在线地图服务。