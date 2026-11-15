import type { request as PlatformRequest } from './types'

export interface BusinessActionIdentity {
  readonly modelFullName: string
  readonly actionName: string
  readonly expectedContractFingerprint?: string
}

export interface BusinessActionInput<P = unknown, D = unknown> {
  readonly params?: P
  readonly data?: D
}

export interface BusinessActionAvailability {
  status: 'EXECUTABLE' | 'BLOCKED' | 'NEEDS_INPUT'
  reasons: string[]
  blockage: 'NONE' | 'AUTHORIZATION' | 'CONTRACT' | 'PRECONDITION'
}

/** The platform request client's native file response. The caller decides how to consume or save it. */
export interface BusinessActionFile {
  readonly fileName: string
  readonly fileContent: Blob
  readonly fileSize: number
  readonly fileType: string
}

/** Calls the same governed Action entry for dynamic and generated clients. */
export function createBusinessActions(getRequest: () => Pick<PlatformRequest, 'post'>) {
  function endpoint(identity: BusinessActionIdentity, operation: string) {
    return `/api/business-model-behaviors/${encodeURIComponent(identity.modelFullName)}/actions/${encodeURIComponent(identity.actionName)}/${operation}`
  }

  function body(identity: BusinessActionIdentity, input: BusinessActionInput) {
    return {
      input,
      ...(identity.expectedContractFingerprint === undefined ? {} : { expectedContractFingerprint: identity.expectedContractFingerprint }),
    }
  }

  return {
    async invoke<I extends BusinessActionInput = BusinessActionInput, O = unknown>(identity: BusinessActionIdentity, input: I): Promise<O> {
      const response = await getRequest().post(endpoint(identity, 'invoke'), body(identity, input))
      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Business Action failed')
      }
      return response.data.data as O
    },

    async invokeFile<I extends BusinessActionInput = BusinessActionInput>(identity: BusinessActionIdentity, input: I): Promise<BusinessActionFile> {
      const response = await getRequest().post(endpoint(identity, 'invoke'), body(identity, input), {
        responseType: 'blob', noSave: false, throwOnError: true,
      })
      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Business Action failed')
      }
      const file = response.data.data as BusinessActionFile
      if (!(file?.fileContent instanceof Blob)) {
        throw new Error('Business Action did not return a file')
      }
      return file
    },

    async checkAvailability(identity: BusinessActionIdentity, input: BusinessActionInput): Promise<BusinessActionAvailability> {
      const response = await getRequest().post(endpoint(identity, 'availability'), body(identity, input))
      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Business Action availability failed')
      }
      return response.data.data as BusinessActionAvailability
    },
  }
}
