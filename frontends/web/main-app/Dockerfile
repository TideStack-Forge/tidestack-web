ARG BASE_IMAGE=nginx:1.28-alpine
FROM ${BASE_IMAGE}

ENV WEB_ROOT=/app/base/web \
    DEPLOY_WEB_ROOT=/app/deploy/web \
    BACKEND_URL=http://127.0.0.1:8080 \
    LISTEN_PORT=80

COPY docker/rootfs/ /
COPY dist /app/base/web

RUN apk add --no-cache gettext \
    && mkdir -p /app/deploy/web /app/deploy/logs/web /app/deploy/nginx/conf.d \
    && chmod +x /usr/local/bin/web-entrypoint

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/web-entrypoint"]
