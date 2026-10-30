# GameVault · v2.5.0

一个轻量、响应式的浏览器小游戏站点，包含 **贪吃蛇、2048、扫雷**。前端与排行榜 API 已分离：前端可以独立部署到 GitHub Pages；GitHub Actions 会自动运行测试、发布静态前端，并生成可下载的完整项目 ZIP。

## 这版最重要的变化

**你不需要在自己的电脑上安装 Node.js 或运行项目。** 将项目文件上传到 GitHub 后，GitHub Actions 会在云端完成检查、打包和 GitHub Pages 发布。你只需要使用浏览器管理 GitHub 仓库。

- 当前版本：**v2.5.0 · GitHub Pages 自动部署版**。
- 每次向 `main` 或 `master` 分支 Push，都会自动运行测试与发布检查。
- 检查通过后，Actions 自动将 `frontend/` 发布到 GitHub Pages。
- 同一次工作流还会生成完整项目 ZIP，包含前端、后端、测试、配置、文档和 Actions 工作流。
- 完整 ZIP 和 SHA-256 校验文件作为 Actions Artifact 保留 90 天，可直接从 GitHub 下载。
- 支持在 Actions 页面手动运行部署工作流（`workflow_dispatch`）。
- GitHub Pages 只托管静态前端，不运行 Node.js 后端。默认情况下三款游戏可直接运行，成绩保存在访问者自己的浏览器；需要跨设备共享排行榜时，再单独部署后端 API。

## 项目结构

```text
frontend/                    静态前端，GitHub Pages 实际发布目录
  index.html
  assets/css/styles.css      主题、布局与响应式样式
  assets/js/                 API 适配、主题与首页交互
  games/                     三款独立小游戏
  .nojekyll                  禁用 Pages 的 Jekyll 处理
backend/                     可选 Node.js 排行榜 API
  server.js
  Dockerfile
  test/
scripts/
  dev.js                     可选本地开发启动器
  verify-release.js          发布前检查
.github/workflows/
  pages.yml                  Push / 手动触发：自动测试、发布检查、Pages 部署与完整源码 ZIP 打包
.env.example                 后端环境变量模板
README.md                    项目说明
GITHUB-PAGES-CHECKLIST.md    GitHub 网页部署检查清单
STAGE5-REPORT.md             本阶段改造与验证报告
```

## 一、通过 GitHub 网页部署（无需本机运行）

### 第 1 步：创建 GitHub 仓库

1. 登录 GitHub，点击右上角 `+` → `New repository`。
2. 仓库名称可填写 `GameVault`。
3. 建议选择 `Public`（GitHub Free 的公开仓库可使用 Pages）。如果使用私有仓库，请先确认你的 GitHub 计划支持该仓库的 Pages 功能。
4. 创建仓库。建议不要勾选自动生成 README、License 或 `.gitignore`，避免首次上传时出现文件冲突。

### 第 2 步：上传项目文件

1. 下载并解压本项目 ZIP（建议解压到一个新文件夹，例如 `GameVault-v2.5.0`）。
2. 打开解压后出现的项目文件夹。
3. 在 GitHub 仓库页面选择 `Add file` → `Upload files`。
4. 将项目文件夹**里面的所有文件和目录**拖入上传区域，包括隐藏目录 `.github/`、隐藏文件 `.nojekyll` 和 `.gitignore`；不要只上传 ZIP 文件本身，也不要把整个项目文件夹作为一个子目录上传。
5. 在页面底部选择提交到 `main` 分支，然后点击 `Commit changes`。

> 如果 GitHub 网页没有显示隐藏文件，请确认 `.github/workflows/pages.yml` 和 `.nojekyll` 也已上传。缺少工作流文件时，GitHub 不会自动部署。

### 第 3 步：开启 GitHub Pages 的 Actions 部署方式

1. 打开仓库 `Settings` → `Pages`。
2. 在 `Build and deployment` 的 `Source` 中选择 **GitHub Actions**。
3. 不需要选择 `Deploy from a branch`，也不需要配置本地构建命令。

### 第 4 步：等待自动发布

1. 打开仓库顶部的 `Actions`。
2. 找到 `GameVault · GitHub Pages 部署与完整源码打包` 工作流。
3. 等待 `Run automated tests`、`Verify release files and references`、`Upload static frontend to Pages` 和 `Deploy to GitHub Pages` 全部成功。
4. 成功后，在工作流运行详情页的 `deploy` job / `github-pages` environment 中查看发布 URL。通常项目站点地址形如 `https://你的用户名.github.io/仓库名/`。
5. 以后每次向 `main` 或 `master` 分支提交修改，都会自动重新检查和发布。

如果仓库默认分支不是 `main` 或 `master`，请在 `.github/workflows/pages.yml` 和 `.github/workflows/ci.yml` 的 `branches` 列表中加入你的分支名称。

### 第 5 步：从 GitHub 下载完整项目 ZIP

1. 打开仓库 `Actions`。
2. 点击最新一次成功的 `GameVault · GitHub Pages 部署与完整源码打包` 运行记录。
3. 在运行详情页底部的 `Artifacts` 区域，下载 `GameVault-v2.5.0-full-project`。
4. 下载内容包含完整项目 ZIP 和 `.sha256` 校验文件，默认保留 **90 天**。每次部署都会生成新的版本包。

你也可以在 `Actions` → 选择该工作流 → `Run workflow`，手动触发一次检查、打包和部署。

## 二、游戏与排行榜说明

GitHub Pages 是静态托管服务，**不能运行 `backend/server.js` 或 Docker 容器**。

- 只想在线玩贪吃蛇、2048 和扫雷：无需额外后端。玩家的成绩、历史记录保存在各自浏览器的本地存储中。
- 想让不同设备或不同玩家共享排行榜：需要把 `backend/` 单独部署到支持 Node.js 的服务（例如 Render、Railway、Fly.io 或自己的服务器），并通过 HTTPS 提供 API。
- 后端部署完成后，在 `frontend/assets/js/config.js` 中将 `apiBaseUrl` 设置为 `https://你的后端域名/api`，并在后端设置 `CORS_ORIGINS` 为实际 Pages 网站的 Origin。重新提交后，Actions 会自动发布新的前端。
- 不要把数据库密码、API 私钥或其他秘密写入前端 `config.js`；前端配置会公开给所有访问者。

## 三、功能概览

- 统一的深色 / 浅色主题，记住用户的主题选择。
- 响应式首页、游戏卡片搜索、最近游玩的游戏入口。
- 贪吃蛇：方向键 / WASD、空格暂停、触屏方向键与画布滑动控制、最高分记录。
- 2048：方向键 / WASD、滑动和触屏方向键、撤销一步、最高分记录。
- 扫雷：首次点击及邻格保护、自动展开空白区域、右键 / 插旗模式、最佳用时；支持键盘方向导航和 F 键插旗。
- 离线优先的成绩保存：API 不可用时记录进入本机待同步队列，API 恢复后自动重试。
- 可选 REST API：输入校验、请求体大小限制、CORS 白名单、频率限制、并发安全的成绩写入与幂等提交。
- 无第三方 npm 依赖，使用 Node.js 内置模块与测试框架。

## 四、可选：后端 API 配置

本地默认允许 `http://localhost:5173` 和 `http://127.0.0.1:5173`。部署 API 时，用 `CORS_ORIGINS` 指定允许的前端 Origin，多个来源用逗号分隔：

```bash
CORS_ORIGINS=https://你的用户名.github.io PORT=3001 node backend/server.js
```

然后编辑 `frontend/assets/js/config.js`：

```js
window.GAMEVAULT_CONFIG = {
  apiBaseUrl: "https://你的后端域名/api"
};
```

如果地址留空，GitHub Pages 静态部署会使用浏览器本地记录。API 不可用时，待同步成绩会保留在本机，并在网络恢复后重试。

## 五、可选：本地开发与测试

日常使用和 GitHub Pages 发布不需要本地运行。只有开发者希望在本机调试后端时，才需要 Node.js 18 或更高版本：

```bash
npm test
npm run verify:release
npm run dev
```

## 六、后端环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | API 监听端口（1–65535） |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 允许的前端 Origin，逗号分隔 |
| `RATE_LIMIT` | `30` | 每个来源 IP 每分钟允许的成绩提交数 |
| `DATA_FILE` | `backend/data/leaderboard.json` | 排行榜 JSON 数据文件路径 |

`.env.example` 仅作配置模板；项目不依赖 `dotenv`，部署平台需要自行设置环境变量。

## 七、测试与发布检查

```bash
npm test
npm run verify:release
```

GitHub Actions 会在云端运行这两项检查；只有检查通过，Pages 部署和完整源码打包才会继续。`npm test` 覆盖后端 API、安全边界、静态资源路由，以及贪吃蛇、2048、扫雷核心逻辑和前端离线成绩同步。
