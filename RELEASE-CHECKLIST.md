# GameVault v2.5.0 发布检查清单

## GitHub 网页部署前

- [ ] 将解压后的项目文件和隐藏的 `.github/` 目录上传到 GitHub 仓库根目录。
- [ ] 使用 `main` 或 `master` 分支，或在两个 workflow 的分支过滤器中添加实际分支名称。
- [ ] 在 Settings → Pages → Build and deployment → Source 中选择 **GitHub Actions**。
- [ ] 确认仓库包含 `.github/workflows/ci.yml` 与 `.github/workflows/pages.yml`。

## 自动发布

- [ ] 在 Actions 中确认测试和 `npm run verify:release` 均通过。
- [ ] 确认 Pages workflow 成功部署到 `github-pages` environment。
- [ ] 打开部署 URL，检查首页、贪吃蛇、2048 和扫雷页面。
- [ ] 在该次 workflow 运行详情的 Artifacts 区域下载完整项目 ZIP 和 SHA-256 文件。
- [ ] 确认完整项目 artifact 的保留期为 90 天。

## 可选共享排行榜

- [ ] 将 `backend/` 部署到支持 Node.js 的独立服务。
- [ ] 配置 HTTPS API 地址到 `frontend/assets/js/config.js`。
- [ ] 将后端 `CORS_ORIGINS` 设置为真实 GitHub Pages Origin。
- [ ] 为后端排行榜数据配置持久化存储。

## 部署边界

- 日常使用和 GitHub Pages 发布不需要在个人电脑上安装 Node.js 或运行项目；Node.js 检查由 GitHub-hosted runner 自动执行。
- GitHub Pages 只托管 `frontend/` 静态文件，不会运行 Node.js API。
- 未配置线上 API 时，网站仍可运行，成绩保存在访问者自己的浏览器。
- 共享排行榜需要独立后端；不要将后端密钥写入公开前端配置。
