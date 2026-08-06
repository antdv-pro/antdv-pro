# 生产部署说明

## 部署前检查

1. 复制环境变量模板：

```bash
cp .env.example .env.production
```

2. 修改 `.env.production` 中所有 `change_me` 和 OSS/RDS/Redis 密钥。
3. 执行环境变量检查：

```bash
set -a && . ./.env.production && set +a
pnpm deploy:check
```

## 构建与启动

### 方式 A：单机 Docker Compose（ECS 上同时运行 MySQL/Redis）

```bash
pnpm install --frozen-lockfile
set -a && . ./.env.production && set +a
pnpm deploy:check
pnpm migrate:mysql
pnpm verify:mysql
pnpm build
docker compose --env-file .env.production up -d --build
```

当前项目的 `pnpm build` 会先执行 `vue-tsc`。云端上线必须先通过 `pnpm migrate:mysql` 和 `pnpm verify:mysql`，确认真实 MySQL 表结构、系统种子数据和业务表查询能力正常后，再构建和启动容器。

### 方式 B：阿里云推荐模式（ECS + RDS MySQL + Redis + OSS）

`.env.production` 中使用阿里云内网地址：

```bash
DB_HOST=你的RDS内网地址
DB_PORT=3306
DB_NAME=enterprise_system
DB_USER=你的RDS账号
DB_PASSWORD=你的RDS密码
REDIS_HOST=你的Redis内网地址
REDIS_PASSWORD=你的Redis密码
OSS_PROVIDER=aliyun
OSS_BUCKET=你的OSS Bucket
OSS_REGION=oss-cn-你的区域
OSS_ENDPOINT=https://oss-cn-你的区域.aliyuncs.com
DB_REQUIRED=true
```

执行：

```bash
pnpm install --frozen-lockfile
set -a && . ./.env.production && set +a
pnpm deploy:check
pnpm migrate:mysql
pnpm verify:mysql
pnpm clean:fake:mysql
CLEAN_FAKE_DATA_CONFIRM=true pnpm clean:fake:mysql
pnpm import:system:mysql
pnpm import:business:mysql
IMPORT_BUSINESS_CONFIRM=true pnpm import:business:mysql
pnpm build
docker compose -f docker-compose.aliyun.yml --env-file .env.production up -d --build
```

`docker-compose.aliyun.yml` 不启动本地 MySQL/Redis，业务数据全部进入阿里云 RDS/Redis；ECS 本地只保留容器、日志和临时上传卷。当前服务端生产产物监听容器内 `127.0.0.1:3000`，API 镜像内置 `socat` 转发到 `api:3001` 给 Nginx 访问。

## 数据库初始化

`docker-compose.yml` 首次启动 MySQL 时会自动执行：

- `deploy/mysql/init/001_init_schema.sql`
- `deploy/mysql/init/002_seed_system.sql`

为方便本地录入真实测试数据、整理后再迁移到云端，项目统一保留了一份测试数据归档目录：

- `storage/test-data/json`：当前本地测试业务数据(JSON)
- `storage/test-data/sql`：当前业务 SQL 草案
- `storage/test-data/mysql-init`：初始化 MySQL 脚本

当前本地 mock 持久化模块默认从 `storage/test-data/json` 读取和写入，不再分散到多个目录。建议在录入真实测试数据时，只维护这一处目录。

生产环境必须设置 `DB_REQUIRED=true`。该模式下贸易订单、酒店营收、对账归档、运输运营等业务模块禁止从 `storage/test-data/json` 或 runtime JSON 自动回灌数据；数据库缺失或配置不完整时接口应失败，而不是回退到本地文件。

`deploy/mysql/init/002_seed_system.sql` 只保留系统基础数据：用户、组织、角色、菜单、按钮和字典；不再写入规费、办公用车、运输等业务样例。业务数据上云必须显式导入，避免删除旧假数据后又被初始化脚本补回。

上线后新增、修改、删除的数据均写入云端数据库；不需要依赖本地电脑。建议日常只通过网页录入业务数据，代码更新通过 Git 拉取或 CI/CD 重新构建镜像。

当前已提供清理和导入脚本：

```bash
pnpm clean:fake:mysql
CLEAN_FAKE_DATA_CONFIRM=true pnpm clean:fake:mysql
pnpm import:system:mysql
pnpm import:business:mysql
IMPORT_BUSINESS_CONFIRM=true pnpm import:business:mysql
```

说明：

- `pnpm clean:fake:mysql` 默认只预览将清理的业务表数量；设置 `CLEAN_FAKE_DATA_CONFIRM=true` 后才会软删/清空旧业务数据和迁移期 JSON 状态表。
- `pnpm import:system:mysql` 会把 `storage/test-data/json/system.json` 导入 MySQL 系统基础表。
- `pnpm import:business:mysql` 默认只预览规费、办公用车、运输运营、贸易订单数量；设置 `IMPORT_BUSINESS_CONFIRM=true` 后才写入 MySQL。
- 所有 MySQL 脚本会拒绝 `your-*`、`replace_*`、`change_me*` 等占位配置，避免误连本地或模板数据库。

初始化内容包括：

- 系统用户、组织、岗位、角色、用户角色
- 菜单权限、角色菜单、按钮权限
- 系统字典
- 登录日志、操作日志、附件表

管理员账号为 `admin`。首次启动必须通过 `ADMIN_INITIAL_PASSWORD` 提供至少 12 位的一次性强密码；登录后应立即修改，再把该环境变量轮换为另一条未使用的强随机值并妥善保管。

## 安全配置

- `JWT_SECRET` 和 `SESSION_SECRET` 必须至少 32 位，不能使用模板值。
- `/api` 后端接口默认需要 `Authorization`，登录接口和健康检查除外。
- Nginx 已配置基础安全头、上传大小限制、静态资源缓存。
- 文件上传限制由 `UPLOAD_MAX_SIZE_MB` 和 `UPLOAD_ALLOWED_EXTENSIONS` 控制。
- SQL 初始化脚本使用固定 DDL/DML；业务查询落库时必须使用参数化查询，不拼接用户输入。
- 前端展示用户输入时继续依赖 Vue 默认转义，不使用未净化的 `v-html`。

## 日志与备份

服务探针：

- `/api/healthz` 只检查 API 进程是否存活，供容器健康检查使用。
- `/api/readyz` 同时检查 MySQL 是否可连接，发布验收和外部监控必须检查该地址；数据库不可用时返回 HTTP 503。
- `DB_CONNECT_TIMEOUT_MS` 默认 5000 毫秒，避免数据库网络异常时请求长时间挂起。

## 数据存储与导出交付

生产环境的前端统一通过同域 `/api` 访问后端接口。业务数据不依赖操作人员本地电脑，必须以生产数据库和上传附件目录作为迁移、备份和交付依据。

业务数据存储：

- 单机 Docker Compose 模式下，业务数据保存在 Compose 的 `mysql_data` 卷中，数据库名默认为 `enterprise_system`。
- 阿里云推荐模式下，业务数据保存在 `.env.production` 配置的 RDS MySQL 中，连接信息由 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD` 确定。
- 工资/薪资审批、办公用车、审批记录、系统用户、组织、角色、字典等数据应随 MySQL 备份一起交付。

附件/PDF/票据存储：

- 前端上传接口为 `/api/uploads`。
- 当前服务端上传目录由 `UPLOAD_DIR` 决定，默认是 API 容器内 `./uploads`；生产 Compose 映射到 `uploads_data:/app/uploads`。
- Web 容器以只读方式挂载 `uploads_data:/data/uploads`，并通过 `/uploads/` 对外提供已上传文件访问。
- 迁移时必须同时交付上传附件压缩包，以及数据库中业务记录保存的 `attachmentName`、`attachmentUrl`、`invoiceNo`、`businessId` 等关联字段。

已知导出能力：

- 办公用车费用台账接口：`POST /api/office-vehicle/expenses/export`，前端按钮为“导出费用台账”。
- 审批中心页面提供“导出表格”，用于导出当前筛选范围内的审批列表数据。
- 页面级 Excel 导出不能替代完整迁移包；完整迁移应提供 MySQL 备份、附件压缩包、字段说明/数据字典、单据与附件对应关系。

完整迁移建议交付物：

- MySQL 备份：使用 `deploy/scripts/backup-mysql.sh` 生成 `.sql.gz`。
- 附件备份：使用 `deploy/scripts/backup-uploads.sh` 生成 `uploads_*.tar.gz`。
- 页面导出：工资/薪资审批、办公用车、审批中心按业务需要导出 Excel 或 CSV。
- 说明文件：记录数据库名、导出时间、附件根路径、字段说明、业务表与附件 URL 的对应关系。

日志目录：

- Nginx：`logs/nginx`
- API：`logs/api`
- MySQL：`logs/mysql`

数据库备份：

```bash
set -a && . ./.env.production && set +a
sh deploy/scripts/backup-mysql.sh
```

当前 Docker 生产服务器必须使用容器卷备份入口，同时备份 MySQL 和附件：

```bash
pnpm backup:production
```

生产巡检可手动执行：

```bash
pnpm health:production
```

巡检会验证容器、API、数据库、磁盘、备份新鲜度与校验和，并确认已禁用的异常高 CPU 服务没有重新启动。

2GB ECS 上的纯 API 更新应先在本地完成 `pnpm build` 并同步 `dist/servers`，再执行轻量发布，避免服务器执行完整 Docker 构建：

```bash
pnpm deploy:api:light
```

脚本会在容器内保留临时回滚副本，健康检查或数据库就绪检查失败时自动恢复旧 API 文件。

备份先写临时文件，通过压缩包完整性检查后才原子改名为最终文件，并同时生成 `.sha256` 校验文件。迁移或恢复前必须先执行 `sha256sum -c <备份文件>.sha256`，再进行恢复演练；未生成校验文件或校验失败的文件不能作为有效备份。

上传附件备份：

```bash
UPLOAD_DIR=./uploads BACKUP_DIR=./backups/uploads sh deploy/scripts/backup-uploads.sh
```

建议在服务器 crontab 中配置：

```cron
0 2 * * * cd /opt/enterprise-system && set -a && . ./.env.production && set +a && sh deploy/scripts/backup-mysql.sh >> logs/backup.log 2>&1
30 2 * * * cd /opt/enterprise-system && UPLOAD_DIR=./uploads BACKUP_DIR=./backups/uploads sh deploy/scripts/backup-uploads.sh >> logs/backup.log 2>&1
```

## OSS 附件

`.env.production` 已预留阿里云 OSS 配置。当前代码已提供上传限制工具，后续正式接入上传接口时应：

- 使用 RAM 子账号最小权限。
- 文件名改为服务端生成 object key。
- 上传元数据写入 `sys_attachment`。
- 下载接口检查业务权限后再返回签名 URL。
