# 设计系统（Apple 风格落地）

本文件描述如何在代码中落地 `docs/STYLE_REFERENCE.md`（用户提供的 Apple 风格原文，逐字保留）。原文为最高依据；本文件登记工程消歧结果。

## 设计 Token（`src/app/globals.css` 的 `@theme`）

```css
--color-page: #f5f5f7;      /* 应用页面底色 */
--color-surface: #ffffff;   /* 内容表面 */
--color-ink: #1d1d1f;       /* 标题 */
--color-body: #515154;      /* 正文（AA 对比足够深） */
--color-muted: #6e6e73;     /* 次要文字 */
--color-line: #d2d2d7;      /* 细分隔线 */
--color-accent: #0071e3;    /* Apple 蓝 */
--color-accent-hover: #0077ed;
--color-success: #248a3d;   /* 状态色，配文字使用 */
--color-danger: #d70015;
--radius-card: 16px;
--radius-control: 12px;
--shadow-card: 0 4px 12px rgba(0,0,0,0.08);
--shadow-hover: 0 8px 24px rgba(0,0,0,0.12);
--shadow-sm: 0 2px 8px rgba(0,0,0,0.04);
--ease-apple: cubic-bezier(0.25, 0.1, 0.25, 1);
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
```

## 组件约定（`src/components/ui.tsx`）

- **按钮**：`rounded-full`、主行动 `bg-accent text-white hover:bg-accent-hover`；次要行动黑/灰/纯文字。按压 `active:scale-[0.98]`，`transition-colors duration-200`，最小高度 ≥ 44px。
- **卡片**：`bg-surface rounded-card shadow-card`；悬停 `hover:shadow-hover`；内部图片 `group-hover:scale-105`。
- **输入框**：`bg-page rounded-control placeholder:text-muted focus:ring-2 focus:ring-accent`。
- **徽章**：仅用于状态，且颜色 + 文字并存，不单独用颜色传意。

## 明确消歧（对照任务书 4.1）

| 冲突 | 采用 |
|---|---|
| 灰底/白底 | 页面 `#f5f5f7`，内容表面白色 |
| Spring 与禁 bounce | 统一使用 `--ease-apple` 减速曲线，无弹跳 |
| `scale-[0.98]` vs `0.95` | 优先 0.98，不使用 0.95 |
| 主蓝/辅黑 | 主行动蓝色，次要用黑/灰/纯文字 |
| `980px` vs `6xl` | 主内容容器默认 `max-w-[980px]`，发现页地图可到 1200px |
| 黑底 Hero + `text-black` | 不照抄不可读样例，主 Hero 灰/白底黑字 |
| 弱化灰 vs AA | 正文用 `#515154`，不以浅灰牺牲可读性 |
| 动效 vs reduced-motion | 普通减速曲线；`prefers-reduced-motion` 下关闭非必要变形 |

## 禁止项（自动化与人工检查）

不出现：`bg-gradient*`、`shadow-2xl`、`shadow-inner`、`border-2/4/8`、渐变文字、嵌套卡片、禁用字体（Inter/Roboto/Geist）、玻璃态默认、单侧粗边框装饰、tiny uppercase eyebrow、bounce/elastic。

- 颜色只作点缀（黑白灰 + 蓝，绿/红仅状态）。
- 保留大留白与清晰层级；正文行宽受容器约束。
- 图标为同一套线性 SVG（`src/components/icons.tsx`），不用 emoji 充当核心图标。
- 所有图片有替代文字；对话框/面板焦点可管理；滑块可键盘操作。

## 无障碍

- 目标 ≥ 44×44 CSS px；`focus-visible` 有明显描边。
- 正文对比度按 WCAG AA 检查（自动化 + 人工）。
- `prefers-reduced-motion` 下过渡近似关闭（`tests/e2e/a11y.spec.ts` 验证）。
- 三种视口（390×844、768×1024、1440×1000）与 360px 宽度均无横向溢出（截图与脚本验证）。