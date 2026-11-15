let source = null
let sourceOrigin = null
const messageHandler = {}

function isSameOriginMessage(event) {
  return event.origin === window.location.origin
}

window.addEventListener('message', (event) => {
  if (!isSameOriginMessage(event)) {
    return
  }

  const type = event.data && event.data.type
  if (type && messageHandler[type]) {
    source = event.source
    sourceOrigin = event.origin
    messageHandler[type](event.data, event)
  }
})

export function registerHandler(type, handler) {
  messageHandler[type] = handler
}

export function replyToMessageSource(event, data) {
  if (!event || !event.source || !isSameOriginMessage(event)) {
    return
  }

  event.source.postMessage(data, event.origin)
}

// 回传信息
export function sendMessage(data) {
  if (!source || !sourceOrigin) {
    return
  }

  source.postMessage(data, sourceOrigin)
}
