# 部署与自动化流程说明

本项目使用 GitHub Actions + SSH + Docker Compose 实现自动部署到服务器。

## 一、本地需要做的事

1. **确保本地仓库使用 main 分支并已推送到 GitHub**

   ```bash
   git branch -M main
   git push -u origin main
   ```

2. **以后正常开发流程**

   - 修改代码后：

     ```bash
     git add .
     git commit -m "your change"
     git push origin main
     ```

   - 每次推送到 `main` 分支，都会自动触发部署流程。

## 二、GitHub 仓库需要做的事

1. **添加 SSH 私钥 Secret**

   1. 在本地打开你的私钥文件，例如：
      `C:\Users\28623\.ssh\keys\ssh-key-2025-02-04.key`，复制全部内容。
   2. 打开 GitHub 仓库页面 → `Settings` → `Secrets and variables` → `Actions` → `New repository secret`。
   3. 名称填写：`SSH_PRIVATE_KEY`。
   4. 值粘贴刚才复制的私钥完整内容 → 保存。

2. **确认已存在的工作流文件**

   仓库中已经创建：`.github/workflows/deploy.yml`

   - 触发条件：推送到 `main` 分支。
   - 作用：
     - 使用 `SSH_PRIVATE_KEY` 登录服务器 `ubuntu@40.233.65.88`。
     - 在服务器目录 `~/ArtPivot` 内执行：
       - `git fetch origin main`
       - `git reset --hard origin/main`
       - `docker compose up -d --build`

## 三、服务器上需要做的事

1. **已完成的准备（按你的当前状态）**

   - 已经在服务器上执行过一次：

     ```bash
     cd ~
     git clone <你的 GitHub 仓库地址> ArtPivot
     cd ArtPivot
     docker compose up -d --build
     ```

   - 已经给 `ubuntu` 用户加入 docker 组，可以直接执行 `docker` 命令：

     ```bash
     docker ps
     ```

   - 在 `~/ArtPivot/backend` 目录下手动创建并维护生产环境变量文件 `.env.production`。

2. **以后不再需要手动部署**

   以后只需要：

   - 在本地正常写代码并推送到 `main`；
   - GitHub Actions 会自动：
     - SSH 登录服务器；
     - 进入 `~/ArtPivot` 目录；
     - 拉取最新代码并通过 `docker compose up -d --build` 更新和重启容器。

3. **如需手动干预**

   如果某次自动部署失败，或需要手动重启，可以在服务器上执行：

   ```bash
   cd ~/ArtPivot
   git fetch origin main
   git reset --hard origin/main
   docker compose up -d --build
   ```

## 四、验证自动部署是否生效

1. 在本地改动一个很小的地方（例如文案或前端样式）。
2. 提交并推送到 `main`：

   ```bash
   git add .
   git commit -m "test auto deploy"
   git push origin main
   ```

3. 打开 GitHub 仓库的 `Actions` 标签页：
   - 找到 `Deploy to Server` 工作流；
   - 查看是否成功执行（绿色 ✓）；
   - 如失败，点击进入查看日志，根据报错信息排查（例如：SSH 失败、docker 命令失败等）。

部署打地基完成后，你只需要专注开发和 `git push main`，其余由自动化完成。