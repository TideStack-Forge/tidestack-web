import { describe, expect, test } from 'vitest'

const fs = require('node:fs')
const path = require('node:path')

describe('main-app docker publish script', () => {
  test('supports both split-arch publish and optional multi-arch manifest publish', () => {
    const script = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', '..', 'publish-ouroboros-web.sh'),
      'utf8'
    )

    expect(script).toContain('support_multi_arch=false')
    expect(script).toContain('base_image="nginx:1.28-alpine"')
    expect(script).toContain('--build-arg BASE_IMAGE="$base_image"')
    expect(script).toContain('docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/amd64 $targets --push .')
    expect(script).toContain('docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/amd64,linux/arm64 $targets --push .')
    expect(script).toContain('docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/arm64 $targets_arm64 --push .')
    expect(script).toContain('targets_arm64="$targets_arm64 -t $registry/$namespace/$image_name:$tag-arm64"')
    expect(script).toContain('npm ci --legacy-peer-deps --registry="$npm_registry"')
    expect(script).toContain('npm ci --legacy-peer-deps')
    expect(script).not.toContain('npm install --legacy-peer-deps')
  })
})
