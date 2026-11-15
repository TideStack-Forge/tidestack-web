const { test, expect } = require('@playwright/test')

const APP_NAME = 'demo'
const MICRO_FRONTEND_ROUTE = `/dev/${APP_NAME}/project-generator-micro-web`
const BACKEND_EXTENSION_ROUTE = `/dev/${APP_NAME}/project-generator-backend-extension`
const PLATFORM_COMPONENT_LIBRARY_ROUTE = '/platform-component-lib'

function ok(data) {
  return {
    code: 0,
    status: 0,
    msg: '',
    data,
  }
}

async function fulfillJson(route, data) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  })
}

function template({
  templateId,
  templateVersion,
  compatibilityRowId,
  title,
  description,
  channel = 'stable',
}) {
  return {
    templateId,
    templateVersion,
    compatibilityRowId,
    title,
    description,
    channel,
  }
}

function catalog(scope, includePreview) {
  const stableTemplates = scope === 'MICRO_FRONTEND'
    ? [
        template({
          templateId: 'frontend.micro-app',
          templateVersion: '1.0.0',
          compatibilityRowId: 'frontend.micro-app-1.0.0-platform-2.0.0',
          title: '前端应用',
          description: '生成可挂载到平台的前端应用。',
        }),
      ]
    : scope === 'PLATFORM_COMPONENT_LIBRARY'
      ? [
          template({
            templateId: 'frontend.platform-component-library',
            templateVersion: '1.0.0',
            compatibilityRowId: 'frontend.platform-component-library-1.0.0-platform-2.0.0',
            title: '平台组件库',
            description: '生成可上传到公共组件库的项目。',
          }),
        ]
      : [
        template({
          templateId: 'backend.extension.spring-autoconfigure',
          templateVersion: '1.0.0',
          compatibilityRowId: 'backend.extension.spring-autoconfigure-1.0.0-platform-2.0.0',
          title: '后端 Maven 扩展包',
          description: '生成后端自动配置扩展包。',
        }),
      ]
  const previewTemplates = scope === 'MICRO_FRONTEND'
    ? [
        template({
          templateId: 'frontend.login',
          templateVersion: '0.1.0',
          compatibilityRowId: 'frontend.login-0.1.0-platform-2.0.0-preview',
          title: '自定义登录页',
          description: '生成自定义登录页。',
          channel: 'preview',
        }),
      ]
    : []

  return {
    revision: `cat_${scope.toLowerCase()}_42`,
    targetPlatformVersion: '2.0.0',
    scope,
    previewIncluded: includePreview,
    templates: includePreview ? stableTemplates.concat(previewTemplates) : stableTemplates,
  }
}

function templateOption(item) {
  return {
    label: item.title,
    value: `${item.templateId}@${item.templateVersion}#${item.compatibilityRowId}`,
    templateId: item.templateId,
    templateVersion: item.templateVersion,
    compatibilityRowId: item.compatibilityRowId,
    title: item.title,
    description: item.description,
    channel: item.channel,
  }
}


function normalizeGenerationPayload(payload) {
  const template = payload.template || {}
  const parameters = payload.parameters || (payload.scope === 'BACKEND_EXTENSION'
    ? {
        groupId: payload.groupId,
        artifactId: payload.artifactId,
        version: payload.version,
        packageName: payload.packageName,
        autoConfigurationClassName: payload.autoConfigurationClassName,
      }
    : {
        framework: payload.framework,
        buildTool: payload.buildTool,
        packageName: payload.packageName,
        ...(payload.scope === 'MICRO_FRONTEND' ? { includeExampleRoute: payload.includeExampleRoute } : {}),
      })
  return {
    scope: payload.scope,
    catalogRevision: payload.catalogRevision,
    targetPlatformVersion: payload.targetPlatformVersion,
    templateId: payload.templateId || template.templateId,
    templateVersion: payload.templateVersion || template.templateVersion,
    compatibilityRowId: payload.compatibilityRowId || template.compatibilityRowId,
    allowPreview: payload.allowPreview,
    parameters,
  }
}

function projectGenerationForm(scope) {
  const view = catalog(scope, false)
  const firstTemplate = view.templates[0]

  return {
    type: 'form',
    wrapWithPanel: true,
    mode: 'horizontal',
    title: false,
    data: {
      ...(scope === 'PLATFORM_COMPONENT_LIBRARY' ? {} : { appName: APP_NAME }),
      scope: view.scope,
      catalogRevision: view.revision,
      targetPlatformVersion: view.targetPlatformVersion,
      allowPreview: false,
      ...formDefaults(scope),
      template: templateOption(firstTemplate),
    },
    body: [
      {
        type: 'list-select',
        id: 'project-generator-template',
        name: 'template',
        label: '项目模板',
        required: true,
        clearable: false,
        joinValues: false,
        extractValue: false,
        labelField: 'label',
        valueField: 'value',
        itemSchema: {
          type: 'tpl',
          tpl: '<div><strong>${label}</strong><div class="text-muted">${description}</div></div>',
        },
        options: view.templates.map(templateOption),
      },
      ...parameterItems(scope),
    ],
    api: {
      method: 'post',
      url: `${projectGenerationApiBase(scope)}/project-generations`,
      responseType: 'blob',
    },
    actions: [
      {
        type: 'button',
        label: '取消',
        actionType: 'cancel',
      },
      {
        type: 'submit',
        label: '生成并下载',
        level: 'primary',
      },
    ],
  }
}

function formDefaults(scope) {
  if (scope === 'BACKEND_EXTENSION') {
    return {
      groupId: '',
      artifactId: '',
      version: '0.1.0-SNAPSHOT',
      packageName: '',
      autoConfigurationClassName: 'ExtensionAutoConfiguration',
    }
  }
  return {
    framework: 'react',
    buildTool: 'webpack',
    packageName: '',
    ...(scope === 'MICRO_FRONTEND' ? { includeExampleRoute: true } : {}),
  }
}

function parameterItems(scope) {
  if (scope === 'BACKEND_EXTENSION') {
    return [
      inputItem('groupId', 'Maven groupId', 'com.example'),
      inputItem('artifactId', 'Maven artifactId', 'customer-extension'),
      inputItem('version', '项目版本', '0.1.0-SNAPSHOT', '0.1.0-SNAPSHOT'),
      inputItem('packageName', 'Java 包名', 'com.example.customer.extension'),
      inputItem('autoConfigurationClassName', '自动配置类名', 'ExtensionAutoConfiguration', 'ExtensionAutoConfiguration', false),
    ]
  }
  return [
    {
      type: 'button-group-select',
      id: 'project-generator-framework',
      name: 'framework',
      label: '技术栈',
      value: 'react',
      required: true,
      options: [
        { label: 'React', value: 'react' },
        { label: 'Vue', value: 'vue' },
      ],
    },
    {
      type: 'button-group-select',
      id: 'project-generator-buildTool',
      name: 'buildTool',
      label: '构建方式',
      value: 'webpack',
      required: true,
      options: [
        { label: 'Webpack', value: 'webpack', visibleOn: "${framework === 'react'}" },
        { label: 'Vite', value: 'vite', visibleOn: "${framework === 'vue'}" },
      ],
    },
    inputItem('packageName', 'npm 包名', '@your-scope/customer-portal'),
    ...(scope === 'MICRO_FRONTEND'
      ? [{
          type: 'switch',
          id: 'project-generator-includeExampleRoute',
          name: 'includeExampleRoute',
          label: '包含示例路由',
          value: true,
        }]
      : []),
  ]
}

function inputItem(name, label, placeholder, value, required = true) {
  return {
    type: 'input-text',
    id: `project-generator-${name}`,
    name,
    label,
    required,
    placeholder,
    ...(value ? { value } : {}),
  }
}

function projectGenerationApiBase(scope) {
  return scope === 'PLATFORM_COMPONENT_LIBRARY' ? '/api' : `/api/dev/${APP_NAME}`
}

function projectGeneratorEntryPage(title, scope) {
  return {
    type: 'page',
    title,
    toolbar: [
      {
        type: 'button',
        actionType: 'dialog',
        label: '生成项目',
        level: 'enhance',
        dialog: {
          type: 'dialog',
          title,
          size: 'lg',
          actions: [],
          body: {
            type: 'ui-schema',
            source: {
              method: 'get',
              url: `${projectGenerationApiBase(scope)}/project-generation-form`,
              data: {
                scope,
              },
            },
          },
        },
      },
    ],
    body: {
      type: 'tpl',
      tpl: title,
    },
  }
}

function appInfo(initialPath) {
  return {
    appName: 'Project Generator Harness',
    homePage: initialPath,
    headerEntry: '/debug-console-header/',
    layoutType: 'sidebar-split',
    defaultTheme: 'default',
    currentTheme: 'default',
    config: {
      'security.session.idleLogout': false,
    },
    routes: [
      {
        path: '/dev/:appName/project-generator-micro-web',
        title: '微前端项目生成',
        type: 'amis',
        config: {
          schemaId: '/playwright/project-generator/micro-web',
        },
      },
      {
        path: '/dev/:appName/project-generator-backend-extension',
        title: '后端扩展包项目生成',
        type: 'amis',
        config: {
          schemaId: '/playwright/project-generator/backend-extension',
        },
      },
      {
        path: PLATFORM_COMPONENT_LIBRARY_ROUTE,
        title: '平台组件库项目生成',
        type: 'amis',
        config: {
          schemaId: '/playwright/project-generator/platform-component-library',
        },
      },
    ],
  }
}

async function mockHarnessApis(page, state) {
  await page.route('**/api/sys/web-app-info', async (route) => {
    await fulfillJson(route, ok(appInfo(state.initialPath)))
  })
  await page.route('**/api/sys/user/info', async (route) => {
    await fulfillJson(route, ok({
      userIdentity: '',
      username: 'project-generator-playwright',
      roles: [],
    }))
  })
  await page.route('**/api/authored-menu-tree', async (route) => {
    await fulfillJson(route, ok({
      main: [
        {
          title: '微前端项目生成',
          name: 'project-generator-micro-web',
          path: MICRO_FRONTEND_ROUTE,
          url: MICRO_FRONTEND_ROUTE,
          type: 'amis',
          children: [],
        },
        {
          title: '后端扩展包项目生成',
          name: 'project-generator-backend-extension',
          path: BACKEND_EXTENSION_ROUTE,
          url: BACKEND_EXTENSION_ROUTE,
          type: 'amis',
          children: [],
        },
        {
          title: '平台组件库项目生成',
          name: 'project-generator-platform-component-library',
          path: PLATFORM_COMPONENT_LIBRARY_ROUTE,
          url: PLATFORM_COMPONENT_LIBRARY_ROUTE,
          type: 'amis',
          children: [],
        },
      ],
      secondary: [],
    }))
  })
  await page.route('**/api/i18n/languages', async (route) => {
    await fulfillJson(route, ok({ items: [] }))
  })
  await page.route('**/api/i18n/locale/*', async (route) => {
    await fulfillJson(route, ok({ common: {} }))
  })
  await page.route('**/api/auth/authorities', async (route) => {
    await fulfillJson(route, ok({}))
  })
  await page.route('**/api/user-setting', async (route) => {
    await fulfillJson(route, ok({}))
  })
  await page.route('**/api/app/container**', async (route) => {
    await fulfillJson(route, ok({}))
  })
  await page.route('**/api/ui-schema**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const schemaPath = requestUrl.searchParams.get('path')

    if (schemaPath === '/dev/container-control-buttons' || schemaPath === '/dev/helper-control-buttons') {
      await fulfillJson(route, ok({
        type: 'button-group',
        buttons: [],
      }))
      return
    }

    if (schemaPath === '/playwright/project-generator/micro-web') {
      await fulfillJson(route, ok(projectGeneratorEntryPage('微前端项目生成', 'MICRO_FRONTEND')))
      return
    }

    if (schemaPath === '/playwright/project-generator/backend-extension') {
      await fulfillJson(route, ok(projectGeneratorEntryPage('后端扩展包项目生成', 'BACKEND_EXTENSION')))
      return
    }

    if (schemaPath === '/playwright/project-generator/platform-component-library') {
      await fulfillJson(route, ok(projectGeneratorEntryPage('平台组件库项目生成', 'PLATFORM_COMPONENT_LIBRARY')))
      return
    }

    await fulfillJson(route, {
      code: 404,
      status: 404,
      msg: 'Schema Not Found',
      data: null,
    })
  })
  await page.route(`**/api/dev/${APP_NAME}/project-templates**`, async (route) => {
    const requestUrl = new URL(route.request().url())
    const scope = requestUrl.searchParams.get('scope')
    const includePreview = requestUrl.searchParams.get('includePreview') === 'true'
    state.catalogRequests.push({ scope, includePreview })
    await fulfillJson(route, ok(catalog(scope, includePreview)))
  })
  await page.route((url) => url.pathname === `/api/dev/${APP_NAME}/project-generation-form`, async (route) => {
    const requestUrl = new URL(route.request().url())
    const scope = requestUrl.searchParams.get('scope')
    state.formRequests.push({ scope })
    await fulfillJson(route, ok(projectGenerationForm(scope)))
  })
  await page.route((url) => url.pathname === '/api/project-generation-form', async (route) => {
    const requestUrl = new URL(route.request().url())
    const scope = requestUrl.searchParams.get('scope')
    state.formRequests.push({ scope })
    await fulfillJson(route, ok(projectGenerationForm(scope)))
  })
  await page.route(`**/api/dev/${APP_NAME}/project-generations`, async (route) => {
    state.generationRequests.push(normalizeGenerationPayload(route.request().postDataJSON()))
    await route.fulfill({
      status: 200,
      contentType: 'application/zip',
      headers: {
        'content-disposition': 'attachment; filename="generated-project.zip"',
      },
      body: 'PK project-generator-smoke',
    })
  })
  await page.route('**/api/project-generations', async (route) => {
    state.generationRequests.push(normalizeGenerationPayload(route.request().postDataJSON()))
    await route.fulfill({
      status: 200,
      contentType: 'application/zip',
      headers: {
        'content-disposition': 'attachment; filename="generated-project.zip"',
      },
      body: 'PK project-generator-smoke',
    })
  })
}

async function openHarness(page, initialPath) {
  const state = {
    initialPath,
    catalogRequests: [],
    formRequests: [],
    generationRequests: [],
  }
  await mockHarnessApis(page, state)
  await page.goto(`/debug-topbar-playwright-harness.html?path=${encodeURIComponent(initialPath)}&title=${encodeURIComponent('项目生成器')}`)
  await page.waitForFunction(() => window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__?.ready === true)
  await expect(page.getByTestId('debug-topbar-harness-status')).toHaveText('Debug topbar harness ready')
  return state
}

test('micro frontend entry loads stable templates and downloads a generated source ZIP', async ({ page }) => {
  const state = await openHarness(page, MICRO_FRONTEND_ROUTE)

  await page.getByRole('button', { name: '生成项目' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('前端应用', { exact: true })).toBeVisible()
  await expect(page.getByText('生成可挂载到平台的前端应用。').first()).toBeVisible()
  await expect(page.getByText('React', { exact: true })).toBeVisible()
  await expect(page.getByText('Webpack', { exact: true })).toBeVisible()
  await page.locator('input[placeholder="@your-scope/customer-portal"]').fill('@example/customer-portal')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '生成并下载' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('generated-project.zip')
  expect(state.formRequests).toContainEqual({ scope: 'MICRO_FRONTEND' })
  expect(state.generationRequests).toContainEqual(expect.objectContaining({
    scope: 'MICRO_FRONTEND',
    templateId: 'frontend.micro-app',
    templateVersion: '1.0.0',
    compatibilityRowId: 'frontend.micro-app-1.0.0-platform-2.0.0',
    allowPreview: false,
    parameters: expect.objectContaining({
      framework: 'react',
      buildTool: 'webpack',
      packageName: '@example/customer-portal',
      includeExampleRoute: true,
    }),
  }))
})

test('backend extension entry downloads the single official Maven extension template', async ({ page }) => {
  const state = await openHarness(page, BACKEND_EXTENSION_ROUTE)

  await page.getByRole('button', { name: '生成项目' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('后端 Maven 扩展包', { exact: true })).toBeVisible()
  await expect(page.getByText('生成后端自动配置扩展包。')).toBeVisible()
  await page.locator('input[placeholder="com.example"]').fill('com.example')
  await page.locator('input[placeholder="customer-extension"]').fill('demo-extension')
  await page.locator('input[placeholder="com.example.customer.extension"]').fill('com.example.demo.extension')
  await page.locator('input[placeholder="ExtensionAutoConfiguration"]').fill('DemoExtensionAutoConfiguration')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '生成并下载' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('generated-project.zip')
  expect(state.formRequests).toContainEqual({ scope: 'BACKEND_EXTENSION' })
  expect(state.generationRequests).toContainEqual(expect.objectContaining({
    scope: 'BACKEND_EXTENSION',
    templateId: 'backend.extension.spring-autoconfigure',
    templateVersion: '1.0.0',
    compatibilityRowId: 'backend.extension.spring-autoconfigure-1.0.0-platform-2.0.0',
    allowPreview: false,
    parameters: expect.objectContaining({
      groupId: 'com.example',
      artifactId: 'demo-extension',
      version: '0.1.0-SNAPSHOT',
      packageName: 'com.example.demo.extension',
      autoConfigurationClassName: 'DemoExtensionAutoConfiguration',
    }),
  }))
})

test('public platform component library entry uses the global generator API', async ({ page }) => {
  const state = await openHarness(page, PLATFORM_COMPONENT_LIBRARY_ROUTE)

  await page.getByRole('button', { name: '生成项目' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('平台组件库', { exact: true })).toBeVisible()
  await page.getByText('Vue', { exact: true }).click()
  await page.getByText('Vite', { exact: true }).click()
  await page.locator('input[placeholder="@your-scope/customer-portal"]').fill('@example/platform-components')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '生成并下载' }).click()
  await downloadPromise

  expect(state.formRequests).toContainEqual({ scope: 'PLATFORM_COMPONENT_LIBRARY' })
  expect(state.generationRequests).toContainEqual(expect.objectContaining({
    scope: 'PLATFORM_COMPONENT_LIBRARY',
    templateId: 'frontend.platform-component-library',
    parameters: expect.objectContaining({
      framework: 'vue',
      buildTool: 'vite',
      packageName: '@example/platform-components',
    }),
  }))
})
