import { startTransition } from 'react'
import { addMiddleware, isStateTreeNode } from 'mobx-state-tree'

const OBSERVED_ACTION_NAMES = new Set([
  'fetchInitData',
  'appendCooperativeRow',
  'appendCooperativeRows',
  'publishCooperativeRows',
  'failCooperativeMaterialization',
  'finishCooperativeMaterialization',
  'prepareCooperativeEventContext',
  'startCooperativeViewportHydration',
  'finishViewportHydration',
  'initRows',
  'replaceItems',
  'setLoading',
  'setValues',
  'submit',
  'updateData',
  'validate',
  'validateFields',
])
const COOPERATIVE_ACTION_NAMES = new Set(['initRows', 'submit'])

export function installMstActionInstrumentation(rootStore, options = {}) {
  const onMark = typeof options.onMark === 'function' ? options.onMark : () => {}
  const cooperativeScheduling = options.cooperativeScheduling === true
  onMark('mst-instrumentation-status', {
    hasRootStore: Boolean(rootStore),
    isStateTreeNode: Boolean(rootStore && isStateTreeNode(rootStore)),
  })

  if (!rootStore || !isStateTreeNode(rootStore)) {
    return () => {}
  }

  let sequence = 0
  const seenActionNames = new Set()
  const attachedStores = new WeakSet()
  const disposers = []

  function observeCall(call, next) {
    if (!seenActionNames.has(call.name)) {
      seenActionNames.add(call.name)
      onMark('mst-action-seen', {
        actionName: call.name,
        actionType: call.type,
        path: call.path,
      })
    }

    if (!OBSERVED_ACTION_NAMES.has(call.name)) {
      next(call)
      return
    }

    const token = `${call.id}:${call.type}:${sequence++}`
    const detail = {
      token,
      actionName: call.name,
      actionType: call.type,
      path: call.path,
      id: call.id,
      rootId: call.rootId,
      parentId: call.parentId,
      cooperativeScheduling,
    }

    const run = () => {
      next(call, (result) => {
        onMark('mst-action-end', detail)
        return result
      })
    }

    onMark('mst-action-start', detail)
    if (cooperativeScheduling && COOPERATIVE_ACTION_NAMES.has(call.name)) {
      startTransition(run)
    } else {
      run()
    }
  }

  function attachStore(store) {
    if (
      !store ||
      !isStateTreeNode(store) ||
      attachedStores.has(store)
    ) {
      return
    }
    attachedStores.add(store)
    disposers.push(addMiddleware(store, observeCall, false))
  }

  Object.values(rootStore.stores || {}).forEach(attachStore)
  attachStore(rootStore)

  disposers.push(
    addMiddleware(
      rootStore,
      (call, next) => {
        next(call, (result) => {
          if (call.name === 'addStore') {
            attachStore(result)
          }
          return result
        })
      },
      false
    )
  )

  return () => {
    disposers.splice(0).reverse().forEach((dispose) => dispose())
  }
}
