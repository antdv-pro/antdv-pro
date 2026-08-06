# 阿里云上线步骤

目标：把当前项目部署到阿里云 ECS，并让 `www.erpxt.online` 直接访问。

## 1. 阿里云控制台准备

1. 域名解析：
   - `www.erpxt.online` 添加 `A` 记录到 ECS 公网 IP。
   - 可选：`erpxt.online` 也添加 `A` 记录到同一公网 IP。
2. ECS 安全组放行：
   - `80/tcp`，用于网页访问。
   - `22/tcp`，用于 SSH。
   - 如果后续配置 HTTPS，再放行 `443/tcp`。
3. 数据库建议使用阿里云 RDS MySQL 8.0，Redis 建议使用阿里云 Redis，并把 ECS 加入白名单或同 VPC 访问组。

## 2. ECS 安装基础环境

以下以 Ubuntu/Debian 为例：

```bash
sudo apt update
sudo apt install -y curl git ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

重新登录 SSH 后安装 Node 20 和 pnpm：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable
corepack prepare pnpm@10.30.2 --activate
node -v
pnpm -v
docker compose version
```

## 3. 上传或拉取代码

推荐放在 `/opt/enterprise-system`：

```bash
sudo mkdir -p /opt/enterprise-system
sudo chown -R $USER:$USER /opt/enterprise-system
cd /opt/enterprise-system
```

如果有 Git 仓库：

```bash
git clone <你的仓库地址> .
```

如果还没有仓库，可以从本地同步：

```bash
rsync -av --exclude node_modules --exclude .git --exclude logs --exclude tmp ./ root@<ECS公网IP>:/opt/enterprise-system/
```

## 4. 配置生产环境变量

```bash
cd /opt/enterprise-system
cp .env.production.aliyun.example .env.production
nano .env.production
```

必须修改这些值：

- `DB_HOST`、`DB_USER`、`DB_PASSWORD`
- `REDIS_HOST`、`REDIS_PASSWORD`
- `JWT_SECRET`、`SESSION_SECRET`
- `OSS_REGION`、`OSS_BUCKET`、`OSS_ENDPOINT`、`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`

如果暂时不接 OSS，可以保留占位值，但后续上传附件相关能力会受影响。

## 5. 初始化数据库并构建

```bash
pnpm install --frozen-lockfile
set -a && . ./.env.production && set +a
pnpm deploy:check
pnpm migrate:mysql
pnpm verify:mysql
pnpm repair:data:mysql
REPAIR_PRODUCTION_DATA_CONFIRM=true pnpm repair:data:mysql
pnpm clean:fake:mysql
CLEAN_FAKE_DATA_CONFIRM=true pnpm clean:fake:mysql
pnpm import:system:mysql
pnpm import:business:mysql
IMPORT_BUSINESS_CONFIRM=true pnpm import:business:mysql
pnpm repair:data:mysql
REPAIR_PRODUCTION_DATA_CONFIRM=true pnpm repair:data:mysql
pnpm build
```

`repair:data:mysql`、`clean:fake:mysql` 和 `import:business:mysql` 默认是预览模式。确认数量无误后，再带 `REPAIR_PRODUCTION_DATA_CONFIRM=true`、`CLEAN_FAKE_DATA_CONFIRM=true` 或 `IMPORT_BUSINESS_CONFIRM=true` 执行写库。生产环境不会从本地 JSON 自动回灌业务数据。

## 6. 启动服务

```bash
docker compose -f docker-compose.aliyun.yml --env-file .env.production up -d --build
docker compose -f docker-compose.aliyun.yml ps
```

健康检查：

```bash
curl -i http://127.0.0.1/healthz
curl -i http://127.0.0.1/api/healthz
curl -i http://www.erpxt.online/healthz
```

浏览器访问：

```text
http://www.erpxt.online
```

管理员账号是 `admin`。首次启动前必须设置至少 12 位的一次性强密码 `ADMIN_INITIAL_PASSWORD`；首次登录修改密码后，将该环境变量轮换为另一条未使用的强随机值并妥善保管。

## 7. 常用运维命令

查看日志：

```bash
docker compose -f docker-compose.aliyun.yml logs -f --tail=200
```

更新代码后重新部署：

```bash
git pull
pnpm install --frozen-lockfile
set -a && . ./.env.production && set +a
pnpm migrate:mysql
pnpm verify:mysql
pnpm build
docker compose -f docker-compose.aliyun.yml --env-file .env.production up -d --build
```

备份数据库：

```bash
set -a && . ./.env.production && set +a
sh deploy/scripts/backup-mysql.sh
```

## 8. HTTPS 后续配置

当前配置先保证 `http://www.erpxt.online` 可直接访问。HTTPS 可以在稳定后加：

1. 用阿里云 SSL 证书或 Let's Encrypt 申请 `www.erpxt.online` 证书。
2. 在 ECS 外层安装宿主机 Nginx/Caddy 终止 TLS，再反代到本项目 `WEB_PORT=8080`。
3. 或改造容器 Nginx 挂载证书并监听 `443`。
