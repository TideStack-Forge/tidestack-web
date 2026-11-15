import React from 'react'
import ReactDOM from 'react-dom'
import { renderAmisSchema } from '@/components/amis/AmisComponent'
import '@/style/index.scss'
window.React = React
window.ReactDOM = ReactDOM

async function mount() {
  const editorFixture = new URLSearchParams(window.location.search).has('editor')
    ? await fetch('/behavior-editor-fixture').then((response) => response.json())
    : null
  const rendered = await renderAmisSchema(
    document.getElementById('catalog-harness'),
    {
      type: 'page',
      body: [
        {
          type: 'form',
          id: 'behaviorHarness',
          name: 'behaviorHarness',
          wrapWithPanel: false,
          data: editorFixture
            ? undefined
            : {
                namespace: 'sales',
                name: 'Order',
                modelType: 'default',
                title: '订单',
                events: [],
              },
          body: editorFixture?.body || [
            {
              type: 'business-model-format-upgrade',
              name: 'behaviorFormatUpgrade',
              appName: 'example',
              label: false,
            },
            {
              type: 'input-text',
              name: 'title',
              label: '模型标题',
              placeholder: '输入模型标题',
            },
            {
              type: 'business-behavior-catalog',
              name: 'behaviorCatalog',
              appName: 'example',
              label: false,
            },
            {
              type: 'json-data-editor',
              name: 'events',
              label: '动态事件定义',
              allowValueTypes: 'array',
            },
          ],
        },
      ],
    },
    editorFixture ? { data: editorFixture.data } : {}
  )
  const scope = rendered.getScopeRef()
  let form
  const startedAt = Date.now()
  while (Date.now() - startedAt < 5000) {
    form =
      scope.getComponentByName('behaviorHarness') ||
      scope.getComponentById('behaviorHarness')
    if (form?.getValues) break
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }
  if (!form?.getValues) throw new Error('Harness form did not register correctly')
  if (editorFixture) form.setValues(editorFixture.data, undefined, true)
  window.behaviorCatalogHarness = { values: () => form.getValues(), ready: true }
}
mount().catch((error) => {
  document.body.textContent = error.stack
})
