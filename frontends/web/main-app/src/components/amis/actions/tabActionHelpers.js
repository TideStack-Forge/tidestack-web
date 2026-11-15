export function normalizeReceiveActions(receiveActions, renderer) {
  if (!Array.isArray(receiveActions) || receiveActions.length === 0) {
    return undefined
  }

  return (payload) => {
    receiveActions.forEach((action) => {
      if (action) {
        renderer.props.onAction('', action, payload)
      }
    })
  }
}
