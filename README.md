# ArtPivot ✨

你好，这里是 ArtPivot！

## 🎃这里有

- 🧭 纵向时间轴：时期与代表作一目了然。
- 🖼️ 作品卡片：点开就能看到封面、年份、艺术家和描述。
- 🤖 AI 导入：上传 Word 文档即可自动提作品信息。
- 🎞️ ARTH1001：课程专用复习内容。

## 🚀 网站链接

[部署地址待补充](https://example.com)

## 🧰 技术栈

- 前端：React + TypeScript
- 后端：Express + MongoDB + Cloudinary

## ⚙️ 启动与部署

- 开发环境：`npm install` 后在仓库根目录运行 `npm run dev`，即可同时启动前端与后端。
- 构建部署：使用 `npm run build` 生成前端静态文件与后端编译结果，再将 `frontend/build` 与 `backend/dist` 部署到服务器。
- Docker 部署：
	- 填写 `backend/.env.production` 中的 MongoDB、Cloudinary 等变量。
	- 在服务器上执行 `docker compose up -d --build`，容器会分别构建前后端并通过 `docker-compose.yml` 统一编排。
	- 当前映射：后端暴露 `5001`（便于调试），前端通过宿主 `8082` → 容器 `80` 提供页面服务，如需改端口修改 `docker-compose.yml` 中对应的 `ports`。


