/* @vitest-environment jsdom */

const React = require('react')
const { getRendererByName } = require('amis-core')
const ImageControl = require('amis/lib/renderers/Form/InputImage').default

function classnames(...values) {
  return values.filter((value) => typeof value === 'string' && value).join(' ')
}

function createStaticImageControl(value, props = {}) {
  return new ImageControl({
    ...ImageControl.defaultProps,
    classnames,
    translate: (key) => key,
    render: () => null,
    data: {},
    env: {},
    static: true,
    disabled: false,
    value,
    crop: true,
    reCropable: true,
    draggable: true,
    onChange: () => {},
    dispatchEvent: async () => null,
    ...props,
  })
}

function renderDropzoneContent(control) {
  const root = control.render()
  const dropzone = React.Children.toArray(root.props.children).find(
    (node) => typeof node?.props?.children === 'function'
  )

  if (!dropzone) {
    throw new Error('ImageControl did not render its dropzone')
  }

  const content = dropzone.props.children({
    getRootProps: (props) => props,
    getInputProps: () => ({}),
    isDragActive: false,
    isDragAccept: false,
    isDragReject: false,
  })

  return { content, dropzone }
}

function collectElements(value, elements = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectElements(item, elements))
    return elements
  }

  if (!React.isValidElement(value)) {
    return elements
  }

  elements.push(value)
  Object.values(value.props).forEach((prop) => collectElements(prop, elements))
  return elements
}

function hasClass(elements, className) {
  return elements.some((element) =>
    element.props.className?.split(' ').includes(className)
  )
}

describe('AMIS ImageControl static behavior', () => {
  it('uses the native FormItem registration without a strict project override', () => {
    const renderer = getRendererByName('input-image')

    expect(renderer).toMatchObject({
      type: 'input-image',
      name: 'input-image',
      sizeMutable: false,
    })
    expect(renderer.strictMode).toBeUndefined()
    expect(renderer.override).toBeUndefined()
    expect(typeof renderer.shouldComponentUpdate).toBe('function')
  })

  it('keeps an empty static image field read-only without an add control', () => {
    const { content, dropzone } = renderDropzoneContent(
      createStaticImageControl(undefined)
    )
    const elements = collectElements(content)

    expect(dropzone.props.disabled).toBe(true)
    expect(hasClass(elements, 'ImageControl-dropzone')).toBe(true)
    expect(hasClass(elements, 'ImageControl-addBtn')).toBe(false)
    expect(hasClass(elements, 'ImageControl-uploadBtn')).toBe(false)
  })

  it('keeps existing static images viewable without mutation controls', () => {
    const { content, dropzone } = renderDropzoneContent(
      createStaticImageControl(
        ['https://example.test/logo-a.png', 'https://example.test/logo-b.png'],
        { multiple: true }
      )
    )
    const elements = collectElements(content)
    const tooltips = elements
      .map((element) => element.props['data-tooltip'])
      .filter(Boolean)

    expect(dropzone.props.disabled).toBe(true)
    expect(tooltips).toContain('Image.zoomIn')
    expect(tooltips).not.toContain('Select.upload')
    expect(tooltips).not.toContain('Select.clear')
    expect(tooltips).not.toContain('Image.crop')
    expect(elements.some((element) => element.props['data-role'] === 'dragBar')).toBe(
      false
    )
    expect(hasClass(elements, 'ImageControl-addBtn')).toBe(false)
    expect(hasClass(elements, 'ImageControl-uploadBtn')).toBe(false)
  })
})
