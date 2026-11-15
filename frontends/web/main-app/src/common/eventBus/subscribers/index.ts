import { store } from '@/store/storeFacade'
import { EventBus } from '@/common/eventBus'
EventBus.subscribe('updateAppName', (data) => {
  store.dispatch('app/setAppName', data)
})
EventBus.subscribe('updateMenu', (data) => {
  store.dispatch('user/updateMenu', data)
})
EventBus.subscribe('updateAppLogo', (data) => {
  store.dispatch('app/setAppLogo', data)
})
