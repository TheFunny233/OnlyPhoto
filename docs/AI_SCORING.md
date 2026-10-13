# AI 参考评分与标注交互

本轮为 AI 分析结果加入两层增强：**分维度参考评分**与**点选标注就地查看点评**。

## 为什么是“参考评分”而不是“总分”

原任务书明确要求「不提供貌似客观的总分或专业认证分」。因此本实现：

- 评分标注为 **「0-100（主观参考分，非专业认证）」**，并在界面上重复声明；
- 每个维度必须给出**评分依据**；加分/扣分项必须具体到画面现象；
- **总分由服务端按固定权重计算**，不由模型直接给出，因此可复现、不会自相矛盾；
- 演示模式（mock）**不提供任何评分**——未识别图像却给数字会误导用户，界面会说明如何启用真实评分。

## 数据形状（存储于 `analysis_results.data`）

```jsonc
"score": {
  "overall": 61,                      // 服务端计算（见下）
  "scale": "0-100（主观参考分，非专业认证）",
  "summary": "一句话解释分数来源",
  "dimensions": [
    { "key": "composition", "label": "构图", "score": 75, "weight": 0.25, "reason": "俯视角度与线条引导…" }
  ],
  "pros": [ { "label": "几何美感", "delta": 10, "reason": "双洞隧道与笔直道路的对称结构" } ],
  "cons": [ { "label": "白平衡偏移", "delta": -15, "reason": "明显非自然色罩" } ]
}
```

### 总分算法（服务端，`app/ai/schemas.py`）

```text
overall = round( Σ(dimension.score × weight) / Σ(weight) )   # 权重归一化后取整，clamp 0..100
```

固定权重：构图 0.25、光线 0.25、色彩 0.15、主体 0.20、背景 0.15。模型只需给维度分与理由。

### 校验与规范化（服务端）

| 情况 | 处理 |
|---|---|
| 维度分越界（如 700 / -50） | 裁剪到 0..100 |
| 未知维度 key | 丢弃 |
| 重复维度 | 去重（保留第一个） |
| 加分项给了负数 / 扣分项给了正数 | 符号纠正 |
| 条数超限 | 加分/扣分各最多 5 条 |
| 无任何维度 | `overall` 为 `null`（前端显示 “—”，不编造分数） |
| 缺少 `score` 或 mock 模式 | `score` 为 `null`，界面明确说明 |

## 标注交互（点哪看哪）

- 分析结果中的 `region`（规范化 0..1 坐标）在图片上渲染为可点击高亮框。
- **点击高亮框 → 就地弹出气泡**，显示：优先级 / 是否需要重拍、标题、画面现象、可以怎么试，以及「查看完整点评 →」。
- 点击气泡外的任意位置或按 `Esc` 关闭；点击「查看完整点评」会切换到对应分区并滚动高亮该条目。
- 气泡定位基于容器的相对坐标，离底部空间不足时自动翻到上方，避免被裁切。

## 可解释性与联动（S2）

- **总分可解释**：每个维度显示 `分数 × 权重 = 贡献`，并给出公式说明「总分 = Σ(维度分 × 权重) ÷ Σ(权重)」，让用户看到分数如何得出，降低“分数崇拜”。
- **强弱项可视化**：纯 SVG **雷达图**（无第三方依赖），五轴对应五个维度，一眼看出强项与短板。
- **评分 → 建议联动**：点击任一维度会**跳到该维度相关的第一条建议**并高亮（例如点“色彩”跳到色彩类问题）。
- **评分 → 行动联动**：编辑面板新增「应用 AI 建议参数」，一次性套用建议的曝光/对比度/饱和度/暖冷与裁切，随后仍可手动微调。

### 验证（`artifacts/test-results/score-ui-verify.json`，判定 `UI_OK`）

| 检查 | 结果 |
|---|---|
| 评分卡 | 可见 |
| 雷达图节点 | 10（5 网格 + 5 轴） |
| 公式说明 | 可见 |
| 权重展示 | `× 0.25` 等 |
| 维度跳转并高亮 | ✔ |
| 标注气泡（回归） | ✔ |
| 应用建议参数 | ✔（滑块值随之变化） |
| JS 错误 | 0 |

截图：`artifacts/screenshots/python/workbench-score-radar.png`

## 导出与口径提示（S3）

- **导出评分卡 PNG**：点击「导出评分卡」，用 Canvas 手绘一张卡片（总分、雷达图、维度公式、加分/扣分项、免责声明），导出为 PNG（2× 高清），便于对比或分享。不依赖任何第三方库，也不上传到服务器。
- **评分口径提示**：界面与导出卡片均声明「分数会随所选目标变化（如“更突出主体”与“保留纪实感”可能得到不同评分）」，避免把分数当成与目标无关的绝对标准。

验证（`artifacts/test-results/score-ui-verify.json`，`UI_OK`）：导出按钮可用、PNG 有效（magic bytes 校验通过，约 340KB）、含雷达图与公式。

导出样例：`artifacts/test-results/score-card.png`

## 评分历史与趋势（S4）

- **强制重分析不再覆盖旧记录**：点击「重新分析」会新建一条分析记录（幂等键追加唯一后缀），因此**可以对照分数变化**；而“非强制”的重复请求仍然复用结果，不会刷屏。
- **评分历史区块**：同一照片出现 ≥2 条成功记录时显示，包含
  - **趋势折线**（按时间从旧到新，只画有分数的点，标注具体分值）；
  - **历史列表**（分数、时间、真实/演示模式、一句话摘要，最多 10 条）。
- 获取方式：`GET /api/photos/{id}/history`（仅照片所有者可读，越权返回 404/403）。

### 验证

- 集成测试：`test_forced_reanalysis_keeps_score_history`（首次 1 条 → 非强制复用仍 1 条 → 强制后 2 条）、`test_analysis_history_requires_ownership`。
- E2E（隔离环境）：上传 → 分析 → 重新分析后「评分历史」可见且 ≥2 条。
- 真实环境：同一照片两次真实分析（均 61 分），趋势与列表正常显示；截图 `artifacts/screenshots/python/workbench-score-history.png`。

## 目标口径与偏好权重（S5）

- **目标口径透明**：评分卡显示「本次评分基于：场景 X · 目标 Y」，数据来自该照片最近一次成功的分析记录（`analysis_jobs.scene/goals`），让用户知道分数是在什么前提下给出的。
- **评分偏好**：提供「均衡 / 更看重构图 / 更看重光线 / 更看重色彩 / 更看重主体」五档，**只改变总分的加权方式，不改变各维度分数**。
  - 权重表由服务端默认值（0.25/0.25/0.15/0.20/0.15）派生，偏好选择保存在浏览器 `localStorage`；
  - 切换后**页面总分与导出卡片总分同步重算**，维度行显示当前权重与贡献（如 `× 0.4 = 20.0`）；
  - 界面明确说明该操作不影响维度分，避免误解为“改了分数”。
- 实测：同一张照片在「更看重光线」下总分由 **61 → 59**（光线分偏低，权重提高后总分下降），切回「均衡」复原。

### 防回归

`tests/integration/test_templates.py` 直接渲染模板（含“目标非空 + 有评分”场景），防止 Jinja 过滤器/全局函数缺失导致的整页 500。

## 改前/改后对比与偏好持久化（S6）

- **编辑后重评对比**：编辑面板提供「导出并重评对比」——把当前编辑结果（裁切 + 色调）导出为 JPEG、**作为新照片上传**并重新分析，随后跳到结果页并显示
  「修改前 61 分 → 现在 66 分 （提升 +5 分）」，附「查看上一版 →」与“两次使用同一模型/提示词，分数仍受随机性与目标设置影响”的说明。
  - 该操作**会消耗一次真实分析额度**，点击前有二次确认；
  - 只在新照片上分析，不改动原照片与其历史。
- **偏好持久化到账号**：`GET/PUT /api/me/preferences` 保存 `scorePreference`；页面加载时**账号偏好优先**（浏览器 localStorage 作为离线回退），换设备也可保持一致。

实测（真实调用）：61 → 66（提升 +5）；接口 `/api/me/preferences` 200；截图 `artifacts/screenshots/python/workbench-score-compare.png`。
机读报告：`artifacts/test-results/compare-ui-verify.json`（`COMPARE_OK`）。

### 防回归

`tests/integration/test_templates.py` 新增对比区块渲染断言（`data-before` / `data-after` / `score-delta` / 账号偏好注入）与偏好列存在性检查。

## 服务端统一口径与分享文案（S7）

- **服务端加权口径**：新增 `app/ai/scoring.py`，是偏好权重的**唯一服务端来源**（与前端 `workbench.js` 的常量一致，并有单元测试比对，防止前后端漂移）。
  - 存储的 `overall` 始终用默认权重（稳定、可复现）；
  - API 返回的评分会附带 `preference`、`preferenceLabel`、`overallPreference`（按账号偏好重算），因此第三方消费方与服务端渲染也能拿到与页面一致的口径。
- **复制分享文案**：评分卡新增「复制分享文案」，生成一段纯文本（总分 + 偏好 + 维度分 + 加分/扣分摘要 + 链接）到剪贴板，便于粘贴到聊天或社区。

实测：`analysis.score.overall=61`、`overallPreference=61`、`preferenceLabel=均衡`；复制文本 208 字符且含「总分 N」。

### 防回归

`tests/unit/test_scoring.py`：默认权重与各偏好权重均覆盖五个维度且和为 1、均衡口径与 `_compute_overall` 一致、弱项加权的方向性、未知偏好回退、缺失维度容忍、以及**解析 `workbench.js` 校验前后端权重一致**。

## 个人空间概览与无障碍（S8）

- **我的评分概览**（`/me`）：抽取每张照片**最新一次**评分，展示「已评分 N 张 · 平均 M 分」、最高分前三与最近评分列表（附口径声明）。数据来自已有分析记录，不额外消耗额度。
- **无障碍**：雷达图 SVG 增加 `<title>` 与 `<desc>`（含各维度分值），维度按钮的可访问名改为「构图 82 分，查看相关建议」，便于屏幕阅读器理解。

实测：`/api/me` 返回 `scoreOverview{count:2, average:64, best:[66,61]}`；页面概览区可见、无 JS/HTTP 错误；截图 `artifacts/screenshots/python/me-score-overview.png`。
模板回归：`tests/integration/test_templates.py::test_me_renders_score_overview`（有/无评分两种情况）。

## 面向用户的评分说明页（S9）

- 新增 `/scoring-guide`：用普通用户能读懂的语言解释
  - 为什么叫「参考分」（主观、随目标变化、模型差异）；
  - 五个维度分别看什么；
  - 总分公式与默认权重、偏好只改加权不改维度分；
  - 加分项/扣分项的作用；
  - **适合做 / 不适合做**（明确“不要把它当排名，不要为刷分牺牲表达”）；
  - 演示模式不评分的原因。
- 入口：评分卡的「了解评分口径 →」与页脚「AI 评分口径」。

实测：`/scoring-guide` 200、无横向溢出、无 JS 错误、含全部关键段落；截图 `artifacts/screenshots/python/scoring-guide.png`；报告 `artifacts/test-results/guide-verify.json`（`GUIDE_OK`）。
模板回归：`tests/integration/test_templates.py::test_scoring_guide_renders` 与 workbench 链接断言。

## 练习方向建议（S10）

- 结果页新增「接下来可以练什么」卡片：取**最低分维度**，汇总该维度下已有的分析/修图建议作为练习项，
  并明确声明「不是唯一练习方向，也不代表水平判定」；若各维度均 ≥80 分，则提示可以尝试更有挑战的题材。
- 内容**只引用 AI 已给出的建议**（`finding.action` 或该维度的评分依据），不在此处新增未经验证的结论。

实测：示例照片最低分维度「色彩（45 分）」→ 给出「大幅减少暗角强度，校正白平衡……」。

## 模型输出容错（修复“四部分全为空”）

部分模型（尤其面对中文提示词时）会返回**中文键名或中文类别**。解析层因此改为容错解析（`app/ai/schemas.py`）：

| 情况 | 处理 |
|---|---|
| 键名用中文或变体 | `FIELD_ALIASES`：`strengths｜优点`、`improvements｜可改进处｜问题`、`firstAction｜先做这一件事`、`score｜评分`… |
| 类别/优先级/确定性用中文 | `CATEGORY_ALIASES` 等映射（`构图→composition`、`高→high`） |
| 类别无法识别 | 归入 `other`，**不再丢弃整条** |
| 数组被 dict 包装 | 自动取出 `items/list/结果` |
| 建议写成对象 | 取 `text/suggestion/建议/content` |
| 缺少 `title` | 用 `observation` 兜底 |
| 缺少总览但有其它内容 | 仍然接受（仅记录 warning） |
| 完全空输出 | 明确失败（`error.type=schema`），不产生“假成功”的空报告 |

同时把**模型原始输出片段**保存到 `analysis_jobs.raw_excerpt`（截断 4000 字符），以后遇到解析问题可直接排查，无需再花一次调用。

验证：`tests/unit/test_ai_schemas.py`（中文键、未知类别、dict 包装、缺标题、总览可选）与 `tests/integration/test_analysis_parsing.py`（fake provider 走完整链路，断言四部分非空、总分 62、原始片段已存、历史可读）。

## 标注点评的呈现方式（改进）

早期版本点击标注框会弹出**浮动气泡**，实测问题明显：它是大块白色浮层，**压住照片本身**，还正好挡住它所评论的区域，观感厚重。

现改为**图片下方的点评卡**（`#region-detail`）：

- **彻底不遮挡照片**；框仍保持高亮（选中框加深色环与底色）；
- 卡片结构克制：类别徽章 + 优先级（色点）+ 关闭按钮 → 标题 → 画面现象 → 建议（左侧 2px 引用条）→ 「查看完整点评 →」；
- 快捷键 `Esc` 关闭；切换「编辑预览」自动收起；点击其它框直接切换内容；
- 无障碍：卡片标记 `role="region"`、`aria-live="polite"`，关闭按钮有可访问名。

验证：`artifacts/test-results/score-ui-verify.json`（`regionDetailVisible: true`、`regionDetailClosedByEscape: true`）；截图 `artifacts/screenshots/python/workbench-region-detail.png`；模板断言 `id="region-detail"` 存在且不再有浮层 `region-popover`。

## 来源信息的展示范围

分析结果页的「来源信息（服务端生成）」折叠区**只展示三项**：

- 提示词版本（`promptVersion`）
- 请求 ID（`providerRequestId`）
- 生成时间（`generatedAt`）

供应商、模型、Token 用量与模式**不在该区块展示**（按用户要求精简；这些字段仍保存在服务端 receipt 与 `api_usage` 中用于审计）。**真实/演示模式的区分不受影响**：结果区顶部仍有「真实调用 / 演示模式」徽章。

验证：`artifacts/test-results/receipt-verify.json`（`RECEIPT_OK`：三项保留、四项隐藏、模式徽章仍可见）；截图 `artifacts/screenshots/python/receipt-trimmed.png`。

## 验证证据

- 真实模型（`AI_MODEL=live`）单次分析：`artifacts/test-results/score-verify.json`
  - `overall=61`（构图 75 / 光线 50 / 色彩 45 / 主体 70 / 背景 60）
  - 加分项 2 条（+10 / +5），扣分项 2 条（-15 / -10），`providerRequestId` 可追踪
  - UI：评分卡可见、总分 61、维度 5、气泡可见（`popoverVisible: true`）
- 截图：`artifacts/screenshots/python/workbench-score.png`、`workbench-score-popover.png`
- 单元测试：`tests/unit/test_score.py`（越界裁剪、去重、符号纠正、条数上限、权重计算、无维度时 `overall=null`、演示模式无分）
- E2E：mock 模式下断言「演示模式不提供评分」（`tests/e2e/test_core.py`）

## 已知限制

- 评分是主观参考，不同模型/提示词版本会给出不同结果；界面已声明。
- 模型仍可能给出泛化理由；提示词已要求具体到画面依据，但仍需人工抽检。
- 若供应商不支持结构化输出，评分依赖 JSON 解析与本地校验（本实现已具备）。