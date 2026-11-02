# GameVault UI 阶段六 — 恢复原始游戏区域与外围布局

- **版本：** v2.6.7
- **基线：** v2.6.0 游戏内部布局改造前的基础游戏样式（styles.css）
- **目标：** 优先保证实际可玩区域的尺寸与比例，不再以首屏完整显示为理由压缩游戏画布。

## 调整内容

### 1. 恢复原始游戏区域尺寸

三款游戏的可玩区域最大宽度恢复为 480px：

- 贪吃蛇：画布最大 480×480px，保持 1:1。
- 2048：棋盘最大 480×480px，四列四行等高，单个数字格保持正方形。
- 扫雷：棋盘最大 480×480px，八列八行等高，单个雷格保持正方形。

较窄屏幕仍按容器可用宽度自适应，但不再受视口高度 clamp 限制。桌面窗口高度不足时允许页面纵向滚动。

### 2. 只调整游戏外围布局

新增 `game-layout-stage6.css`，仅负责：
- 页面标题与主游戏列对齐；
- 右侧排行榜 / 小提示采用稳定的辅助栏宽度；
- 平板时将辅助栏放到主游戏下方并可并排展示；
- 手机时将辅助卡片纵向排列。

该样式不选择或修改 `board-stage`、`puzzle-wrap`、`mine-board-wrap`、`puzzle-board`、`tile`、`mine-board`、`mine-cell` 或 `#snake-canvas`。

### 3. 自动化验收

Playwright / Chromium 视口矩阵增加：
- 桌面可玩区域宽度至少 420px；
- 手机可玩区域宽度至少 260px；
- 所有游戏区域宽高差不超过 1.5 CSS px；
- 2048 的 16 个格子、扫雷的 64 个格子均逐个检查宽高一致；
- 检查页面横向无溢出、游戏操作仍可用；
- 不再要求整个游戏面板必须塞进较矮桌面窗口的首屏。

## 保留内容

- 深色 / 浅色主题与主题持久化；
- 页面字体、品牌、按钮和导航；
- 排行榜、本地成绩、API 适配；
- 键盘 / WASD / 触屏控制；
- 游戏逻辑、分数结构和排行榜 API。

## 本轮修改文件

- `frontend/assets/css/game-layout-stage6.css`（新增）
- `frontend/assets/css/game-stage4.css`（停用并移除）
- `frontend/assets/css/styles.css`（2048 / 扫雷正方形网格约束）
- `frontend/games/2048/index.html`
- `frontend/games/snake/index.html`
- `frontend/games/minesweeper/index.html`
- `frontend/test/game-ui.test.js`
- `frontend/test/browser-ui.test.js`
- `README.md`
- `CHANGELOG.md`
- `UI-ROADMAP.md`

## 验收边界

自动化会在 Chromium 的 5 种桌面和 2 种手机尺寸下检查几何尺寸与操作。Firefox、Safari / iOS Safari 尚未纳入本轮浏览器矩阵。
