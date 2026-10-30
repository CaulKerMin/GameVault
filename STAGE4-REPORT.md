# GameVault 阶段四交付报告

版本：`v2.4.0`  
阶段：最终验收与发布  
基线：阶段三 `v2.3.0`

## 本阶段完成

- 新增 `npm run verify:release`，无需第三方依赖即可执行发布前检查。
- 检查项目内全部 JavaScript 文件语法；检查 HTML 本地 `href` / `src` 资源引用和锚点；检查 CSS 的本地资源引用；核对 README 与 `package.json` 版本号。
- 新增 `.github/workflows/ci.yml`，在 Push、Pull Request 和手动触发时运行自动化测试与发布检查。
- 更新 GitHub Pages 工作流，在上传静态站点前先执行测试和发布检查，并配置 Pages 环境及部署 URL 输出。
- 更新 README、CHANGELOG、ROADMAP 和发布清单，明确前后端分离、可选 API 部署、数据持久化和安全边界。
- 版本更新为 `v2.4.0`；没有新增第三方 npm 运行时依赖。

## 自动化验收结果

- `npm test`：**38 项通过，0 项失败**。
- `npm run verify:release`：通过（全部 JavaScript 语法、HTML 本地引用 / 锚点、CSS 资源引用、版本元数据）。
- 本地前端与后端 HTTP 冒烟测试：通过；首页及贪吃蛇 / 2048 / 扫雷页面均返回 HTTP 200，API 健康检查成功，成绩提交后可从排行榜读取。
- ZIP 完整性与解压验证：通过。

## 验收边界

当前环境没有可用的 Docker 运行时和真实图形浏览器，因此没有声称 Docker 镜像已构建、真实云主机已部署或浏览器端到端试玩已通过。GitHub Actions 工作流已纳入项目，但其远端运行结果需要推送到 GitHub 后查看。部署到生产环境后仍应按 `RELEASE-CHECKLIST.md` 执行线上验证。

## 运行

```bash
npm run dev
npm test
npm run verify:release
```

前端：`http://localhost:5173`  
API 健康检查：`http://localhost:3001/api/health`
