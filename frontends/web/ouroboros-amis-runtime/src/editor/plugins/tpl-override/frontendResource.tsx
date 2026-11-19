import { getSchemaTpl, setSchemaTpl } from 'amis-editor-core'
import { createFrontendResourceControlSchema } from '../../resource-browser/FrontendResourceInput'

function resolveSchemaTpl(schemaTpl: any, patch: any, options: any) {
  if (typeof schemaTpl === 'function') {
    return schemaTpl(patch, options)
  }
  return patch
    ? {
        ...schemaTpl,
        ...patch,
      }
    : schemaTpl
}

function createFrontendResourceSchema(schemaTpl: any, patch: any, options: any) {
  return createFrontendResourceControlSchema(
    resolveSchemaTpl(schemaTpl, patch, options),
    {
      selectionMode: 'resource-or-url',
    }
  )
}

const oldImageUrlSchema = getSchemaTpl('imageUrl')
const oldBackgroundImageUrlSchema = getSchemaTpl('backgroundImageUrl')
const oldAudioUrlSchema = getSchemaTpl('audioUrl')
const oldOfficeUrlSchema = getSchemaTpl('officeUrl')

setSchemaTpl('imageUrl', (patch: any, options: any) =>
  createFrontendResourceSchema(oldImageUrlSchema, patch, options)
)

setSchemaTpl('backgroundImageUrl', (patch: any, options: any) =>
  createFrontendResourceSchema(oldBackgroundImageUrlSchema, patch, options)
)

setSchemaTpl('audioUrl', (patch: any, options: any) =>
  createFrontendResourceSchema(oldAudioUrlSchema, patch, options)
)

setSchemaTpl('officeUrl', (patch: any, options: any) =>
  createFrontendResourceSchema(oldOfficeUrlSchema, patch, options)
)
