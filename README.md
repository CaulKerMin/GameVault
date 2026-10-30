# GameVault

GameVault v2.5.0 · GitHub Pages 自动部署版。

本仓库以完整源码压缩包作为发布源。GitHub Actions 会在云端解压源码、运行测试与发布检查、生成可下载的完整 ZIP，并将 `frontend/` 发布到 GitHub Pages。无需在个人电脑安装 Node.js 或运行项目。

## 自动部署

1. 打开仓库 **Settings → Pages**，将 **Build and deployment → Source** 设为 **GitHub Actions**（首次部署时如尚未启用 Pages，请完成此设置）。
2. 打开 **Actions**，运行 **GameVault · GitHub Pages 自动部署与源码打包** 工作流；也可以向 `main` 分支提交更新后自动触发。
3. 等待测试、打包和 Pages 部署步骤全部成功。
4. 网站地址：`https://caulkermin.github.io/GameVault/`（首次部署成功后生效）。
5. 完整源码 ZIP 与 SHA-256 校验文件位于该次 Actions 运行详情页底部的 **Artifacts**，保留 90 天。

## 源码

- 完整项目：[`GameVault-v2.5.0-full-project.zip`](./GameVault-v2.5.0-full-project.zip)
- 校验文件：[`GameVault-v2.5.0-full-project.zip.sha256`](./GameVault-v2.5.0-full-project.zip.sha256)

压缩包包含前端、Node.js 排行榜 API、自动化测试、脚本、文档及原始工作流。

## 重要说明

GitHub Pages 只托管静态前端，不运行 Node.js 后端。三款游戏可直接在浏览器中运行，个人成绩保存在各自浏览器中。跨设备/跨玩家共享排行榜需要另行部署 `backend/`，并在前端配置 HTTPS API 地址。

## 工作流

- `.github/workflows/ci.yml`：Push / Pull Request 自动测试。
- `.github/workflows/pages.yml`：解压完整源码、测试、生成 ZIP 与校验文件、部署 GitHub Pages。
