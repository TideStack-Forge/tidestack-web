function normalizeEvidenceFileName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function attachScreenshotEvidence({ page, testInfo, name, ...screenshotOptions }) {
  const displayName = typeof name === 'string' ? name.trim() : ''
  const fileName = normalizeEvidenceFileName(displayName)

  if (!displayName || !fileName) {
    throw new Error('attachScreenshotEvidence requires a non-empty evidence name')
  }

  const attachmentName = `main-app-host-e2e:${displayName}`
  const screenshotPath = testInfo.outputPath(`main-app-host-e2e-${fileName}.png`)

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    ...screenshotOptions,
  })

  await testInfo.attach(attachmentName, {
    path: screenshotPath,
    contentType: 'image/png',
  })

  return {
    attachmentName,
    screenshotPath,
  }
}

module.exports = {
  attachScreenshotEvidence,
}
