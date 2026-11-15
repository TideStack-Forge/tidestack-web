const fs = require('node:fs/promises')
const zlib = require('node:zlib')

const MEANINGFUL_TEXT_PATTERN = /[A-Za-z0-9\u4e00-\u9fff]/

function normalizeEvidenceFileName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.replace(/\s+/g, ' ').trim()
}

async function stabilizeVisualState(page) {
  await page.evaluate(async () => {
    if (typeof document !== 'undefined') {
      const fontsReady = document.fonts?.ready
      if (fontsReady) {
        await fontsReady
      }

      const pendingImages = Array.from(document.images || []).filter(
        (image) => !image.complete
      )
      await Promise.all(
        pendingImages.map(
          (image) =>
            new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true })
              image.addEventListener('error', resolve, { once: true })
            })
        )
      )
    }

    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  })
}

async function captureDomSnapshot(page, rootSelector = 'body') {
  return page.evaluate(
    ({ rootSelector, meaningfulTextPatternSource }) => {
      const meaningfulTextPattern = new RegExp(meaningfulTextPatternSource)

      function normalizeText(value) {
        if (typeof value !== 'string') {
          return ''
        }
        return value.replace(/\s+/g, ' ').trim()
      }

      function isVisible(element) {
        if (!(element instanceof HTMLElement)) {
          return false
        }
        const style = window.getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden'
      }

      function collectVisibleTexts(root, selector, limit = 30) {
        const seen = new Set()
        const values = []

        for (const node of root.querySelectorAll(selector)) {
          if (!(node instanceof HTMLElement) || !isVisible(node)) {
            continue
          }

          const text = normalizeText(node.textContent || '')
          if (!text || !meaningfulTextPattern.test(text) || seen.has(text)) {
            continue
          }

          seen.add(text)
          values.push(text)
          if (values.length >= limit) {
            break
          }
        }

        return values
      }

      const root = document.querySelector(rootSelector) || document.body
      const topbar = root.querySelector('#custom-topbar')
      const sidebarMicro = root.querySelector('#custom-sidebar')

      return {
        path: window.location.pathname + window.location.search,
        rootSelector,
        rootClassName: normalizeText(root.className || ''),
        headerVisible: isVisible(root.querySelector('.app-header')),
        sidebarVisible: isVisible(root.querySelector('.app-sidebar')),
        loginCardTexts: collectVisibleTexts(root, '.login-card, .login-card *', 40),
        loginAlertTexts: collectVisibleTexts(root, '.login-alert, .login-alert *', 20),
        debugToggleVisible: isVisible(
          root.querySelector(
            '.AMISDebug-toggle, [title="open debug"], [aria-label="open debug"]'
          )
        ),
        customTopbarVisible: isVisible(topbar),
        customTopbarChildren:
          topbar instanceof HTMLElement ? topbar.childElementCount : 0,
        customSidebarVisible: isVisible(sidebarMicro),
        customSidebarChildren:
          sidebarMicro instanceof HTMLElement ? sidebarMicro.childElementCount : 0,
        sidebarHeaderTexts: collectVisibleTexts(
          root,
          '.app-sidebar__header .app-brand__name, .app-sidebar__header .app-brand__text'
        ),
        sidebarFooterTexts: collectVisibleTexts(
          root,
          '.app-sidebar__footer .app-user-menu__name'
        ),
        headerTexts: collectVisibleTexts(root, '.app-header, .app-header *'),
        menuTexts: collectVisibleTexts(
          root,
          '.app-sidebar .dual-mode-menu__text, .app-sidebar .tree-menu__title'
        ),
        bannerTexts: collectVisibleTexts(
          root,
          '.app-content [role="banner"], .app-content [role="banner"] *, .app-content banner, .app-content banner *'
        ),
        activeTabTexts: collectVisibleTexts(
          root,
          '.app-tabs__item.is-active, .app-tabs__item.is-active *',
          10
        ),
        placeholders: Array.from(root.querySelectorAll('input[placeholder]'))
          .map((element) => element.getAttribute('placeholder'))
          .map((value) => normalizeText(value || ''))
          .filter(Boolean),
      }
    },
    {
      rootSelector,
      meaningfulTextPatternSource: MEANINGFUL_TEXT_PATTERN.source,
    }
  )
}

async function attachLayoutParityEvidence({
  page,
  testInfo,
  name,
  rootSelector = 'body',
}) {
  const displayName = typeof name === 'string' ? name.trim() : ''
  const fileName = normalizeEvidenceFileName(displayName)

  if (!displayName || !fileName) {
    throw new Error('attachLayoutParityEvidence requires a non-empty evidence name')
  }

  await stabilizeVisualState(page)
  const domSnapshot = await captureDomSnapshot(page, rootSelector)
  const screenshotBuffer = await page.screenshot({
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  })

  const screenshotPath = testInfo.outputPath(`main-app-layout-parity-${fileName}.png`)
  const domPath = testInfo.outputPath(`main-app-layout-parity-${fileName}-dom.json`)

  await fs.writeFile(screenshotPath, screenshotBuffer)
  await fs.writeFile(domPath, `${JSON.stringify(domSnapshot, null, 2)}\n`)

  await testInfo.attach(`main-app-layout-parity:${displayName}:image`, {
    path: screenshotPath,
    contentType: 'image/png',
  })
  await testInfo.attach(`main-app-layout-parity:${displayName}:dom`, {
    path: domPath,
    contentType: 'application/json',
  })

  return {
    displayName,
    domSnapshot,
    domPath,
    screenshotBuffer,
    screenshotPath,
  }
}

function bytesPerPixel(colorType) {
  switch (colorType) {
    case 0:
      return 1
    case 2:
      return 3
    case 3:
      return 1
    case 4:
      return 2
    case 6:
      return 4
    default:
      throw new Error(`Unsupported PNG color type: ${colorType}`)
  }
}

function paethPredictor(left, up, upLeft) {
  const prediction = left + up - upLeft
  const leftDistance = Math.abs(prediction - left)
  const upDistance = Math.abs(prediction - up)
  const upLeftDistance = Math.abs(prediction - upLeft)

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left
  }

  if (upDistance <= upLeftDistance) {
    return up
  }

  return upLeft
}

function parsePng(buffer) {
  const signature = buffer.subarray(0, 8)
  if (!signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error('Unsupported PNG signature')
  }

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idatChunks = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const chunkData = buffer.subarray(offset + 8, offset + 8 + length)
    offset += length + 12

    if (chunkType === 'IHDR') {
      width = chunkData.readUInt32BE(0)
      height = chunkData.readUInt32BE(4)
      bitDepth = chunkData.readUInt8(8)
      colorType = chunkData.readUInt8(9)
    } else if (chunkType === 'IDAT') {
      idatChunks.push(chunkData)
    } else if (chunkType === 'IEND') {
      break
    }
  }

  return {
    width,
    height,
    bitDepth,
    colorType,
    raw: zlib.inflateSync(Buffer.concat(idatChunks)),
  }
}

function decodePngPixels(buffer) {
  const { width, height, bitDepth, colorType, raw } = parsePng(buffer)
  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth}`)
  }

  const channels = bytesPerPixel(colorType)
  const stride = width * channels
  const decoded = Buffer.alloc(height * stride)

  let srcOffset = 0
  let dstOffset = 0

  for (let row = 0; row < height; row += 1) {
    const filterType = raw[srcOffset]
    srcOffset += 1

    for (let column = 0; column < stride; column += 1) {
      const sourceValue = raw[srcOffset + column]
      const left = column >= channels ? decoded[dstOffset + column - channels] : 0
      const up = row > 0 ? decoded[dstOffset - stride + column] : 0
      const upLeft =
        row > 0 && column >= channels
          ? decoded[dstOffset - stride + column - channels]
          : 0

      let decodedValue = sourceValue
      if (filterType === 1) {
        decodedValue = (sourceValue + left) & 0xff
      } else if (filterType === 2) {
        decodedValue = (sourceValue + up) & 0xff
      } else if (filterType === 3) {
        decodedValue = (sourceValue + Math.floor((left + up) / 2)) & 0xff
      } else if (filterType === 4) {
        decodedValue = (sourceValue + paethPredictor(left, up, upLeft)) & 0xff
      }

      decoded[dstOffset + column] = decodedValue
    }

    srcOffset += stride
    dstOffset += stride
  }

  return {
    width,
    height,
    channels,
    pixels: decoded,
  }
}

function comparePngBuffers(currentBuffer, legacyBuffer) {
  const current = decodePngPixels(currentBuffer)
  const legacy = decodePngPixels(legacyBuffer)

  if (
    current.width !== legacy.width ||
    current.height !== legacy.height ||
    current.channels !== legacy.channels
  ) {
    return {
      sameSize: false,
      diffPixels: Number.POSITIVE_INFINITY,
      totalPixels: 0,
      diffRatio: Number.POSITIVE_INFINITY,
    }
  }

  let diffPixels = 0
  const totalPixels = current.width * current.height

  for (let index = 0; index < current.pixels.length; index += current.channels) {
    const currentPixel = current.pixels.subarray(index, index + current.channels)
    const legacyPixel = legacy.pixels.subarray(index, index + legacy.channels)

    if (!currentPixel.equals(legacyPixel)) {
      diffPixels += 1
    }
  }

  return {
    sameSize: true,
    diffPixels,
    totalPixels,
    diffRatio: totalPixels ? diffPixels / totalPixels : 0,
  }
}

module.exports = {
  attachLayoutParityEvidence,
  comparePngBuffers,
  normalizeText,
}
