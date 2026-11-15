export function reportTabsActionFailure(actionName: string, error: unknown) {
  console.warn(`OuroborosTabs: failed to ${actionName}`, error)
}

export function runTabsAction<T>(
  actionName: string,
  action: () => T | PromiseLike<T>,
  onSuccess?: (value: T) => void,
  onFailure?: (error: unknown) => void
) {
  try {
    void Promise.resolve(action()).then(onSuccess, (error: unknown) => {
      reportTabsActionFailure(actionName, error)
      onFailure?.(error)
    })
  } catch (error) {
    reportTabsActionFailure(actionName, error)
    onFailure?.(error)
  }
}
