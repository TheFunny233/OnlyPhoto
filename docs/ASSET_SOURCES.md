# 素材来源

所有演示图片保存在 `public/demo/`，均为许可清楚的公开图片或本项目生成内容。使用来源：**picsum.photos**（图片来自 Unsplash，遵循 Unsplash License，允许免费使用）。获取日期：2026-10-11。脚本：`scripts/fetch-assets.mjs`（可重复执行，已存在则跳过）。

| 文件 | 用途（演示机位） | 来源 |
|---|---|---|
| `hero.jpg` | 首页 Hero | picsum.photos（seed `photomaster-hero`） |
| `city-skyline.jpg` | 外滩亲水平台·对岸天际线 | picsum.photos（seed `photomaster-city-skyline`） |
| `street-portrait.jpg` | 老街骑楼·雨后人像 | picsum.photos（seed `photomaster-street-portrait`） |
| `lake-reflection.jpg` | 城市公园湖畔·倒影构图 | picsum.photos（seed `photomaster-lake-reflection`） |
| `old-town-bridge.jpg` | 古镇石桥·晨雾 | picsum.photos（seed `photomaster-old-town-bridge`） |
| `night-market.jpg` | 夜市小吃摊·美食特写 | picsum.photos（seed `photomaster-night-market`） |
| `coast-boardwalk.jpg` | 海湾栈道·长曝海景 | picsum.photos（seed `photomaster-coast-boardwalk`） |
| `city-observation.jpg` | 高楼观景台·城市俯瞰 | picsum.photos（seed `photomaster-city-observation`） |
| `mountain-mist.jpg` | 山间步道·云海远眺 | picsum.photos（seed `photomaster-mountain-mist`） |

- 每张图片下载后统一缩放为 1200×800、质量 82 的 JPEG 后保存。
- `artifacts/assets.json` 记录每个文件的获取状态（`downloaded` / `existing` / `generated`）。

## 真实性声明

- 这些图片为**随机公开照片**，**并非** 对应机位的真实实拍。所有演示机位描述均包含「机位数据演示 / 配图非此地实拍」，并在 UI 中以“演示数据”徽章标注。
- 不把演示图片标记为真实机位实拍；不据此提供导航、开放时间、门票等未核实信息。
- 演示机位坐标用于地图交互演示，精确/大致属性均标注。

## 未使用的素材

- 未抓取任何第三方社区内容。
- 图标为项目内自绘线性 SVG（`src/components/icons.tsx`、`public/icon.svg`），不依赖外部图标库。