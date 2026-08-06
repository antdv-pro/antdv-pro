FROM docker.m.daocloud.io/library/nginx:1.27-alpine

LABEL maintainer="enterprise-system"

RUN rm -f /etc/nginx/conf.d/default.conf \
  && mkdir -p /var/log/nginx /usr/share/nginx/html

COPY default.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 dist/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
