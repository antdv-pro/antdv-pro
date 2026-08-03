# 部署目录

- `mysql/init`: MySQL 首次启动初始化脚本。
- `nginx`: 独立 Nginx 配置参考。
- `scripts`: 环境检查、数据库备份、上传附件备份脚本。

敏感配置通过 `.env.production` 注入，不提交真实密码、密钥或 OSS 凭证。
