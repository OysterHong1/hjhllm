# 生产部署说明

本文档记录 `hjhllm` 在 Ubuntu + Docker Compose 服务器上的部署方式。

## 服务组成

- `postgres`: PostgreSQL 16，数据保存在 Docker volume `hjhllm_postgres-data`
- `backend`: FastAPI，监听容器内 `8000`，宿主机仅绑定 `127.0.0.1:8000`
- `frontend`: Next.js standalone server，容器内 `3000`，默认发布到宿主机 `0.0.0.0:80`
- `attachments`: 附件 volume，挂载到后端 `/data/attachments`

## 服务器目录

当前部署目录：

```bash
/root/workspace/hjhllm
```

生产环境变量文件：

```bash
/root/workspace/hjhllm/.env
```

`.env` 至少需要包含：

```bash
POSTGRES_PASSWORD=...
ADMIN_API_TOKEN=...
ENABLE_ADMIN_UI=true
FRONTEND_BIND=0.0.0.0:80
```

`DATABASE_URL` 和 `ATTACHMENT_STORAGE_DIR` 由 compose 在容器环境里覆盖，避免容器内误连宿主机 `127.0.0.1`。

## 首次部署

```bash
ssh s1
cd /root/workspace/hjhllm
docker compose up -d --build
docker compose exec -T postgres psql -U hjhllm -d hjhllm < db/migrations/001_initial_chat_schema.sql
docker compose ps
curl -fsS http://127.0.0.1/api/health
```

如果数据库已经初始化过，重复执行迁移可能报对象已存在；这种情况下先确认表存在即可：

```bash
docker compose exec postgres psql -U hjhllm -d hjhllm -c '\dt'
```

## 日常更新

在本地完成代码改动、验证并提交后，使用固定脚本发布指定 git ref：

```bash
scripts/deploy-release.sh --ref HEAD
# 或：
npm run deploy:prod -- --ref HEAD
```

脚本会从指定 ref 导出干净代码并同步到 `s1:/root/workspace/hjhllm`，然后在服务器执行：

```bash
scripts/server-rebuild.sh
```

`deploy-release.sh` 不同步本地未提交改动，也会保留服务器上的 `.git`、`.env`、`.data`、`node_modules` 和 `.next`。

常用选项：

```bash
scripts/deploy-release.sh --ref main
scripts/deploy-release.sh --ref d195981
scripts/deploy-release.sh --sync-only
```

如果代码已经在服务器目录中，只需要重建和健康检查：

```bash
ssh s1
cd /root/workspace/hjhllm
scripts/server-rebuild.sh
```

## 运维命令

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f frontend backend
```

重启服务：

```bash
docker compose restart frontend backend
```

备份数据库：

```bash
docker compose exec -T postgres pg_dump -U hjhllm -d hjhllm > hjhllm-$(date +%Y%m%d-%H%M%S).sql
```

备份附件 volume：

```bash
docker run --rm -v hjhllm_attachments:/data -v "$PWD":/backup alpine \
  tar czf /backup/hjhllm-attachments-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

## 管理后台

生产环境只有在 `.env` 中设置 `ENABLE_ADMIN_UI=true` 时才暴露 `/admin` 和 `/api/admin-panel/*`。管理员 token 保存在服务器 `.env` 的 `ADMIN_API_TOKEN` 中，不会暴露给浏览器。
