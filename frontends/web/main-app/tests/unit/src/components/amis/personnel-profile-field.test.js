/* @vitest-environment jsdom */

/* @vitest-environment jsdom */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { registerTypescriptRequire, mainAppRoot } = require('../../../helpers/mainAppTestKit')

describe('PersonnelProfileField renderer and plugin', () => {
  let unregisterTypescript

  beforeAll(() => {
    unregisterTypescript = registerTypescriptRequire()
  })

  afterAll(() => {
    if (unregisterTypescript) {
      unregisterTypescript()
    }
  })

  describe('renderer registration', () => {
    it('should export PersonnelProfileField component', () => {
      const rendererPath = path.join(mainAppRoot, 'src/components/amis/renderers/PersonnelProfileField.tsx')
      const rendererModule = require(rendererPath)

      expect(rendererModule.default).toBeDefined()
      expect(rendererModule.default.name).toBe('PersonnelProfileField')
    })

    it('should have correct props interface', () => {
      const rendererPath = path.join(mainAppRoot, 'src/components/amis/renderers/PersonnelProfileField.tsx')
      const rendererModule = require(rendererPath)
      const component = rendererModule.default

      expect(component).toBeDefined()
      expect(typeof component).toBe('function')
    })

    it('should render without crashing when fieldName is provided', () => {
      const rendererPath = path.join(mainAppRoot, 'src/components/amis/renderers/PersonnelProfileField.tsx')
      const rendererModule = require(rendererPath)
      const PersonnelProfileField = rendererModule.default

      const mockRender = (type, schema) => {
        expect(type).toBe('personnel-profile-field-placeholder')
        expect(schema.type).toBe('static')
        return null
      }

      expect(() => PersonnelProfileField({
        fieldName: 'mobile',
        render: mockRender,
      })).not.toThrow()
    })

    it('should render without crashing when fieldName is missing', () => {
      const rendererPath = path.join(mainAppRoot, 'src/components/amis/renderers/PersonnelProfileField.tsx')
      const rendererModule = require(rendererPath)
      const PersonnelProfileField = rendererModule.default

      const mockRender = (_type, schema) => {
        expect(schema.value).toContain('未指定')
        return null
      }

      expect(() => PersonnelProfileField({
        render: mockRender,
      })).not.toThrow()
    })
  })

  describe('editor plugin registration', () => {
    it('should export PersonnelProfileFieldPlugin class', () => {
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')
      const pluginModule = require(pluginPath)

      expect(pluginModule.PersonnelProfileFieldPlugin).toBeDefined()
      expect(typeof pluginModule.PersonnelProfileFieldPlugin).toBe('function')
    })

    it('should have correct plugin metadata', () => {
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')
      const pluginModule = require(pluginPath)
      const Plugin = pluginModule.PersonnelProfileFieldPlugin

      const instance = new Plugin()

      expect(instance.name).toBe('人员档案字段')
      expect(instance.rendererName).toBe('personnel-profile-field')
      expect(instance.panelTitle).toBe('人员档案字段')
      expect(instance.panelIcon).toBe('fa fa-user-circle-o')
      expect(Plugin.scene).toContain('layout')
      expect(instance.tags).toContain('表单项')
      expect(instance.tags).toContain('人员档案')
    })

    it('should have valid scaffold configuration', () => {
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')
      const pluginModule = require(pluginPath)
      const Plugin = pluginModule.PersonnelProfileFieldPlugin

      const instance = new Plugin()

      expect(instance.scaffolds).toBeDefined()
      expect(Array.isArray(instance.scaffolds)).toBe(true)
      expect(instance.scaffolds.length).toBeGreaterThan(0)

      const scaffold = instance.scaffolds[0]
      expect(scaffold.name).toBe('人员档案字段')
      expect(scaffold.scaffold.type).toBe('personnel-profile-field')
      expect(scaffold.scaffold.fieldName).toBeDefined()
      expect(scaffold.previewSchema.type).toBe('personnel-profile-field')
    })

    it('should generate valid panel body configuration', () => {
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')
      const pluginModule = require(pluginPath)
      const Plugin = pluginModule.PersonnelProfileFieldPlugin

      const instance = new Plugin()
      const mockContext = {
        schema: {
          fieldName: 'mobile',
          label: '手机号',
          required: true,
        },
      }

      const panelBody = instance.panelBodyCreator(mockContext)

      expect(Array.isArray(panelBody)).toBe(true)
      expect(panelBody.length).toBeGreaterThan(0)

      const fieldNameControl = panelBody.find((item) => item.name === 'fieldName')
      expect(fieldNameControl).toBeDefined()
      expect(fieldNameControl.type).toBe('input-text')
      expect(fieldNameControl.required).toBe(true)

      const labelControl = panelBody.find((item) => item.name === 'label')
      expect(labelControl).toBeDefined()

      const requiredControl = panelBody.find((item) => item.name === 'required')
      expect(requiredControl).toBeDefined()
      expect(requiredControl.type).toBe('switch')
    })
  })

  describe('integration safety', () => {
    it('should not throw when personnel profile renderer is imported', () => {
      expect(() => {
        require(path.join(mainAppRoot, 'src/components/amis/renderers/PersonnelProfileField.tsx'))
      }).not.toThrow()
    })

    it('should not throw when plugin index is imported', () => {
      expect(() => {
        require(path.join(mainAppRoot, 'src/components/amis/editor/plugins/index.ts'))
      }).not.toThrow()
    })
  })
})
