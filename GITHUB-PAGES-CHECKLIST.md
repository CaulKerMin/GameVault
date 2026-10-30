# GitHub Pages 发布清单

- [ ] 将解压后的项目文件和隐藏的 `.github/` 目录上传到仓库根目录。
- [ ] 使用 `main` 或 `master` 分支（或在工作流分支过滤器中添加实际分支名）。
- [ ] 在 Settings → Pages → Build and deployment → Source 中选择 **GitHub Actions**。
- [ ] 在 Actions 中确认测试和发布检查通过。
- [ ] 确认 `github-pages` environment 显示部署成功并记录站点 URL。
- [ ] 在该次 Actions 运行详情页的 Artifacts 中下载完整项目 ZIP 和 SHA-256 文件。
- [ ] 若要共享排行榜，另行部署 Node.js API，并设置 HTTPS API 地址和 CORS Origin。

日常部署不需要在个人电脑上安装 Node.js 或运行项目；Node.js 测试由 GitHub-hosted runner 自动执行。
