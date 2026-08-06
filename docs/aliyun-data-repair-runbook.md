# 阿里云数据修复与导入步骤

适用目标：让 `https://www.erpxt.online/dashboard/workplace` 可以正常登录、展示中文用户信息、运输/贸易/酒店数据可查询，并避免运输页面直接显示 `500 Internal Server Error`。

## 当前线上已确认的问题

1. 线上仍是旧包：登录页还显示示例管理员账号或固定密码提示。
2. 未登录跳转参数被双重编码：`/login?redirect=%252Fdashboard%252Fworkplace`。
3. 用户信息接口返回乱码：顶部昵称显示为 `è¶…çº§ç®¡ç†å‘˜`。
4. 运输审批关联接口返回 500：`/api/approval/instances?businessType=transport_order` 等。
5. 业务数据没有导入或被清空：运输订单、工作台经营数据多处显示 `No data`。

## 一、先备份线上数据

```bash
cd /opt/enterprise-system
set -a && . ./.env.production && set +a
sh deploy/scripts/backup-mysql.sh
```

如果有上传附件，也备份：

```bash
sh deploy/scripts/backup-uploads.sh
```

## 二、部署最新代码

必须先部署代码修复，否则即使数据修好，登录页提示、redirect 双重编码、500 错误直出仍会存在。

```bash
cd /opt/enterprise-system
git pull
pnpm install --frozen-lockfile
set -a && . ./.env.production && set +a
pnpm deploy:check
pnpm migrate:mysql
pnpm verify:mysql
pnpm build
docker compose -f docker-compose.aliyun.yml --env-file .env.production up -d --build
```

检查容器：

```bash
docker compose -f docker-compose.aliyun.yml ps
docker compose -f docker-compose.aliyun.yml logs -f --tail=200
```

## 三、修复字符集和历史乱码

先预览，不写库：

```bash
pnpm repair:data:mysql
```

确认输出里的乱码修复项无误后写库：

```bash
REPAIR_PRODUCTION_DATA_CONFIRM=true pnpm repair:data:mysql
```

这个命令会：

- 将数据库和表转换为 `utf8mb4`。
- 修复 `sys_user.nickname`、部门、岗位、审批、运输/贸易/酒店/GPS JSON、办公用车等常见字段里的中文乱码。
- 打印关键表数据量，方便确认系统数据是否为空。

## 四、清理旧业务/假数据

先预览：

```bash
pnpm clean:fake:mysql
```

确认要清理后执行：

```bash
CLEAN_FAKE_DATA_CONFIRM=true pnpm clean:fake:mysql
```

注意：这个命令只清理业务数据和审批流程数据，不应删除系统用户、角色、菜单。

## 五、导入系统基础数据

```bash
pnpm import:system:mysql
```

如果你有自己的系统组织/用户 JSON：

```bash
SYSTEM_IMPORT_FILE=/opt/import/system.json pnpm import:system:mysql
```

导入后再次修复可能存在的编码问题：

```bash
REPAIR_PRODUCTION_DATA_CONFIRM=true pnpm repair:data:mysql
```

## 六、导入业务数据

先预览：

```bash
pnpm import:business:mysql
```

确认后写库：

```bash
IMPORT_BUSINESS_CONFIRM=true pnpm import:business:mysql
```

如果你在导入自己的数据文件，可以按模块指定路径：

```bash
TRANSPORT_OPERATION_IMPORT_FILE=/opt/import/transport-operation.json \
TRADE_ORDERS_IMPORT_FILE=/opt/import/trade-orders.json \
HOTEL_REVENUE_IMPORT_FILE=/opt/import/hotel-revenue-records.json \
OFFICE_VEHICLE_IMPORT_FILE=/opt/import/office-vehicle.json \
REGULATORY_FEES_IMPORT_FILE=/opt/import/regulatory-fees.json \
IMPORT_BUSINESS_CONFIRM=true pnpm import:business:mysql
```

如果暂时没有第三方 808GPS 接口数据，导入脚本会根据运输订单里的车牌、司机、路线生成一批 GPS 车辆、设备、实时位置、轨迹、报警和围栏演示数据，保证北斗模块可以打开和验证。接入真实 808GPS API 后，再用真实同步接口替换这批演示数据。

业务数据导完后再跑一次修复和验证：

```bash
REPAIR_PRODUCTION_DATA_CONFIRM=true pnpm repair:data:mysql
pnpm verify:mysql
pnpm verify:live
```

## 七、重启服务并验证页面

```bash
docker compose -f docker-compose.aliyun.yml --env-file .env.production up -d --build
curl -i https://www.erpxt.online/healthz
curl -i https://www.erpxt.online/api/healthz
```

浏览器验证：

1. 打开 `https://www.erpxt.online/dashboard/workplace`。
2. 未登录时应跳到 `/login?redirect=/dashboard/workplace`，不应出现 `%252F`。
3. 登录页不应显示默认账号密码。
4. 登录后顶部用户昵称应是中文，不应出现 `è¶...` 乱码。
5. 打开 `/transport/orders`，页面不应出现 `500 Internal Server Error`。
6. 运输订单、贸易订单、酒店收入页面应能看到导入后的记录。

也可以用脚本自动验收：

```bash
pnpm verify:live
```

线上验证必须通过环境变量显式提供账号和密码：

```bash
LIVE_SITE_USERNAME='<账号>' LIVE_SITE_PASSWORD='<密码>' pnpm verify:live
```

如果脚本退出码是 `2`，表示页面能打开、没有乱码和 500，但业务页仍是空态，需要继续检查业务数据导入文件或导入日志。

## 八、如果还有 500

先看后端日志：

```bash
docker compose -f docker-compose.aliyun.yml logs -f --tail=300
```

再单独查接口：

```bash
TOKEN='<登录后 localStorage 里的 Authorization>'
curl -i -H "Authorization: $TOKEN" 'https://www.erpxt.online/api/user/info'
curl -i -H "Authorization: $TOKEN" 'https://www.erpxt.online/api/approval/instances?businessType=transport_order'
curl -i -H "Authorization: $TOKEN" 'https://www.erpxt.online/api/transport/operations/data'
```

如果 `approval/instances` 仍返回 500，通常是线上容器还没更新到最新代码，或数据库迁移未执行完整。按第二步重新部署，并确认 `pnpm verify:mysql` 通过。
