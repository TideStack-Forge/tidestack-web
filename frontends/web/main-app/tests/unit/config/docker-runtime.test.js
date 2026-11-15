import { describe, expect, test } from 'vitest'

const { readRootFile } = require('../helpers/mainAppTestKit')

describe('main-app docker runtime assets', () => {
  test('Dockerfile upgrades ouroboros-web from scratch to a runnable nginx image', () => {
    const dockerfile = readRootFile('Dockerfile')

    expect(dockerfile).toContain('ARG BASE_IMAGE=nginx:1.28-alpine')
    expect(dockerfile).toContain('FROM ${BASE_IMAGE}')
    expect(dockerfile).toContain('BACKEND_URL=http://127.0.0.1:8080')
    expect(dockerfile).toContain('COPY docker/rootfs/ /')
    expect(dockerfile).toContain('COPY dist /app/base/web')
    expect(dockerfile).toContain('ENTRYPOINT ["/usr/local/bin/web-entrypoint"]')
    expect(dockerfile).not.toContain('FROM scratch')
    expect(dockerfile).not.toMatch(/OUROBOROS_(WEB_ROOT|DEPLOY_WEB_ROOT|LISTEN_PORT|BACKEND_URL)/)
  })

  test('entrypoint validates backend target and renders nginx config', () => {
    const entrypoint = readRootFile('docker/rootfs/usr/local/bin/web-entrypoint')

    expect(entrypoint).toContain('WEB_ROOT=${WEB_ROOT:-/app/base/web}')
    expect(entrypoint).toContain('DEPLOY_WEB_ROOT=${DEPLOY_WEB_ROOT:-/app/deploy/web}')
    expect(entrypoint).toContain('MICRO_PROXY_MAP=${MICRO_PROXY_MAP:-}')
    expect(entrypoint).toContain('LISTEN_PORT=${LISTEN_PORT:-80}')
    expect(entrypoint).toContain('MICRO_PROXY_CONF=/etc/nginx/server-includes/micro-proxies.conf')
    expect(entrypoint).toContain('render_micro_proxy_conf')
    expect(entrypoint).toContain('Ignoring invalid MICRO_PROXY_MAP entry')
    expect(entrypoint).toContain('if [ "${BACKEND_URL+x}" != x ]; then')
    expect(entrypoint).toContain('BACKEND_URL=http://127.0.0.1:8080')
    expect(entrypoint).toContain('BACKEND_URL cannot be empty')
    expect(entrypoint).toContain('BACKEND_URL must start with http:// or https://')
    expect(entrypoint).toContain("envsubst '${WEB_ROOT} ${DEPLOY_WEB_ROOT} ${BACKEND_URL} ${LISTEN_PORT}'")
    expect(entrypoint).toContain('Starting ouroboros-web with backend target:')
  })

  test('nginx template keeps the current proxy and fallback contract', () => {
    const template = readRootFile('docker/rootfs/etc/nginx/templates/default.conf.template')

    expect(template).toContain('include /etc/nginx/server-includes/micro-proxies.conf;')
    expect(template).toContain('proxy_pass              ${BACKEND_URL};')
    expect(template).toContain('location @another-root-index')
    expect(template).toContain('root            ${DEPLOY_WEB_ROOT};')
    expect(template).toContain('location ^~ /websocket/')
    expect(template).toContain('access_log /app/deploy/logs/web/access.log;')
  })
})
