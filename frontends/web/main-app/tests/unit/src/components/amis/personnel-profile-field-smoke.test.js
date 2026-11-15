import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const mainAppRoot = path.resolve(__dirname, '../../../../..')

describe('PersonnelProfileField smoke tests', () => {
  describe('file structure', () => {
    it('should have PersonnelProfileField renderer file', () => {
      const rendererPath = path.join(mainAppRoot, 'src/components/amis/renderers/PersonnelProfileField.tsx')
      expect(fs.existsSync(rendererPath)).toBe(true)
    })

    it('should have PersonnelProfileField plugin file', () => {
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')
      expect(fs.existsSync(pluginPath)).toBe(true)
    })

    it('should be registered in renderers index', () => {
      const indexPath = path.join(mainAppRoot, 'src/components/amis/renderers/index.ts')
      const content = fs.readFileSync(indexPath, 'utf8')
      expect(content).toContain("import './PersonnelProfileField'")
    })

    it('should be registered in plugins index', () => {
      const indexPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/index.ts')
      const content = fs.readFileSync(indexPath, 'utf8')
      expect(content).toContain("import './PersonnelProfileField'")
    })
  })

  describe('renderer implementation', () => {
    it('should have valid TypeScript syntax', () => {
      const rendererPath = path.join(mainAppRoot, 'src/components/amis/renderers/PersonnelProfileField.tsx')
      const content = fs.readFileSync(rendererPath, 'utf8')

      expect(content).toContain('export default function PersonnelProfileField')
      expect(content).toContain("type: 'personnel-profile-field'")
      expect(content).toContain('FormItem(')
    })

    it('should handle missing fieldName gracefully', () => {
      const rendererPath = path.join(mainAppRoot, 'src/components/amis/renderers/PersonnelProfileField.tsx')
      const content = fs.readFileSync(rendererPath, 'utf8')

      expect(content).toContain('未指定')
      expect(content).toContain("fieldName || '未指定'")
    })

    it('should use placeholder rendering approach', () => {
      const rendererPath = path.join(mainAppRoot, 'src/components/amis/renderers/PersonnelProfileField.tsx')
      const content = fs.readFileSync(rendererPath, 'utf8')

      expect(content).toContain('personnel-profile-field-placeholder')
      expect(content).toContain("type: 'static'")
    })
  })

  describe('plugin implementation', () => {
    it('should extend BasePlugin', () => {
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')
      const content = fs.readFileSync(pluginPath, 'utf8')

      expect(content).toContain('export class PersonnelProfileFieldPlugin extends BasePlugin')
      expect(content).toContain('registerEditorPlugin(PersonnelProfileFieldPlugin)')
    })

    it('should have correct metadata', () => {
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')
      const content = fs.readFileSync(pluginPath, 'utf8')

      expect(content).toContain("name = '人员档案字段'")
      expect(content).toContain("rendererName = 'personnel-profile-field'")
      expect(content).toContain("panelIcon = 'fa fa-user-circle-o'")
      expect(content).toContain("static scene: string[] = ['layout']")
    })

    it('should have scaffold configuration', () => {
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')
      const content = fs.readFileSync(pluginPath, 'utf8')

      expect(content).toContain('scaffolds:')
      expect(content).toContain('previewSchema:')
      expect(content).toContain('scaffold:')
    })

    it('should have panelBodyCreator with fieldName control', () => {
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')
      const content = fs.readFileSync(pluginPath, 'utf8')

      expect(content).toContain('panelBodyCreator(context: BaseEventContext)')
      expect(content).toContain("name: 'fieldName'")
      expect(content).toContain('required: true')
    })

    it('should have standard form controls', () => {
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')
      const content = fs.readFileSync(pluginPath, 'utf8')

      expect(content).toContain("name: 'label'")
      expect(content).toContain("name: 'required'")
      expect(content).toContain("name: 'disabled'")
      expect(content).toContain("name: 'description'")
    })
  })

  describe('integration safety', () => {
    it('should not break renderer index imports', () => {
      const indexPath = path.join(mainAppRoot, 'src/components/amis/renderers/index.ts')
      const content = fs.readFileSync(indexPath, 'utf8')

      const imports = content.match(/^import\s+.*$/gm) || []
      expect(imports.length).toBeGreaterThan(0)

      const personnelProfileImport = imports.find((line) => line.includes('PersonnelProfileField'))
      expect(personnelProfileImport).toBeDefined()
      expect(personnelProfileImport).toMatch(/^import\s+['"]\.\/PersonnelProfileField['"]/)
    })

    it('should not break plugin index imports', () => {
      const indexPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/index.ts')
      const content = fs.readFileSync(indexPath, 'utf8')

      const imports = content.match(/^import\s+.*$/gm) || []
      expect(imports.length).toBeGreaterThan(0)

      const personnelProfileImport = imports.find((line) => line.includes('PersonnelProfileField'))
      expect(personnelProfileImport).toBeDefined()
      expect(personnelProfileImport).toMatch(/^import\s+['"]\.\/PersonnelProfileField['"]/)
    })

    it('should follow existing naming patterns', () => {
      const rendererPath = path.join(mainAppRoot, 'src/components/amis/renderers/PersonnelProfileField.tsx')
      const pluginPath = path.join(mainAppRoot, 'src/components/amis/editor/plugins/PersonnelProfileField.tsx')

      expect(fs.existsSync(rendererPath)).toBe(true)
      expect(fs.existsSync(pluginPath)).toBe(true)

      expect(path.basename(rendererPath)).toBe('PersonnelProfileField.tsx')
      expect(path.basename(pluginPath)).toBe('PersonnelProfileField.tsx')
    })
  })
})
