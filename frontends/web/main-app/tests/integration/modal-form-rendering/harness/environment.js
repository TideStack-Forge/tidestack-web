// Host integration is outside this renderer regression; React/MobX/AMIS remain real.
export const pushModalMethods = () => undefined
export const popModalMethods = () => undefined
export const readGetters = () => ({ appConfig: {} })

export const getRouteInfo = () => ({ type: 'amis', schemaId: 'test-form' })

export const processAmisSchema = (_id, schema) => schema
export const EventBus = { subscribe: () => undefined, unsubscribe: () => undefined }
