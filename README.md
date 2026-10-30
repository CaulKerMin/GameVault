# GameVault · v2.5.0

GameVault v2.5.0 · GitHub Pages 自动部署版。你无需在个人电脑安装 Node.js 或运行项目，GitHub Actions 会在云端解压源码、运行测试并部署静态前端。

## 首次设置（只需一次）

1. 将本次交付的 `GameVault-v2.5.0-full-project.zip` 文件直接上传到本仓库根目录（GitHub 网页 → **Add file → Upload files**）。注意：这里上传 ZIP 本身即可，不需要在本机解压或运行。
2. 打开仓库 **Settings → Pages**，将 **Build and deployment → Source** 设为 **GitHub Actions**。
3. 打开 **Actions**，选择 **GameVault · GitHub Pages 自动部署与完整项目打包**，点击 **Run workflow**。后续更新 ZIP 或工作流后会自动触发。
4. 等待测试和部署完成。站点地址为 `https://caulkermin.github.io/GameVault/`。

## 自动化流程

- Actions 在 GitHub 云端解压项目 ZIP。
- 运行 `npm test` 和 `npm run verify:release`。
- 将 `frontend/` 发布到 GitHub Pages。
- 将完整 ZIP 和 SHA-256 校验文件作为 Actions Artifact 保留 90 天。

## 完整项目 ZIP

将 `GameVault-v2.5.0-full-project.zip` 上传到仓库根目录后，工作流会检查该文件并将它附加到每次成功运行的 Artifacts 中。

压缩包包含前端、Node.js 排行榜 API、自动化测试、脚本、文档及原始工作流。

## 重要说明

GitHub Pages 只托管静态前端，不运行 Node.js 后端。三款游戏可直接在浏览器中运行，个人成绩保存在各自浏览器中。跨设备/跨玩家共享排行榜需要另行部署 `backend/`，并在前端配置 HTTPS API 地址。

## 工作流

- `.github/workflows/pages.yml`：解压完整源码、测试、部署 GitHub Pages，并上传完整 ZIP Artifact。
