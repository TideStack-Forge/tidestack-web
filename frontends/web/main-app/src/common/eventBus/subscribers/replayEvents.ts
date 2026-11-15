import { EventBus } from '@/common/eventBus'

// session event, replayStage=SYS_INIT_USER 重放器
EventBus.subscribe('SYS_INIT_USER', () => {
  const replayEventData = sessionStorage.getItem('OuroborosReplayEvents') || '[]'
  const replayEvents = JSON.parse(replayEventData)
  replayEvents
    .filter((item: any) => item.replayStage === 'SYS_INIT_USER')
    .forEach((item: any) => EventBus.publish(item.event, item.data))
})

EventBus.subscribe('SYS_LOGOUT', () => {
  sessionStorage.removeItem('OuroborosReplayEvents')
})

// global event, replayStage=SYS_INIT_USER 重放器
EventBus.subscribe('SYS_INIT_USER', () => {
  const replayEventData = localStorage.getItem('OuroborosReplayEvents') || '[]'
  const replayEvents = JSON.parse(replayEventData)
  replayEvents
    .filter((item: any) => item.replayStage === 'SYS_INIT_USER')
    .forEach((item: any) => EventBus.publish(item.event, item.data))
})
