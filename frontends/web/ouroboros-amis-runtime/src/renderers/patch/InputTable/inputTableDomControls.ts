export type InputTableControlElement = HTMLElement

export const INPUT_TABLE_FOCUSABLE_CONTROL_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[tabindex]',
  '[contenteditable="true"]',
].join(',')

export const INPUT_TABLE_EDITABLE_CONTROL_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="combobox"]',
].join(',')

export function isInputTableVisibleElement(element: HTMLElement) {
  return (
    !element.hidden &&
    !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
  )
}

export function isInputTableDisabledOrReadonlyElement(element: HTMLElement) {
  if (element.getAttribute('aria-disabled') === 'true') {
    return true
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return element.disabled || element.readOnly || element.type === 'hidden'
  }

  if (
    element instanceof HTMLSelectElement ||
    element instanceof HTMLButtonElement
  ) {
    return element.disabled
  }

  return false
}

export function isFocusableInputTableControl(element: HTMLElement) {
  return (
    isInputTableVisibleElement(element) &&
    !isInputTableDisabledOrReadonlyElement(element) &&
    (element.tabIndex >= 0 || element.isContentEditable)
  )
}

export function isEditableInputTableControl(element: HTMLElement) {
  return (
    element.matches(INPUT_TABLE_EDITABLE_CONTROL_SELECTOR) &&
    isFocusableInputTableControl(element)
  )
}

export function findFocusableInputTableControl(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(INPUT_TABLE_FOCUSABLE_CONTROL_SELECTOR)
  ).find(isFocusableInputTableControl)
}

export function findEditableInputTableControl(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(INPUT_TABLE_EDITABLE_CONTROL_SELECTOR)
  ).find(isEditableInputTableControl)
}

export function focusInputTableControl(control: InputTableControlElement) {
  if (document.activeElement === control) {
    return
  }

  control.focus({ preventScroll: true })

  if (
    control instanceof HTMLInputElement ||
    control instanceof HTMLTextAreaElement
  ) {
    control.select()
  }
}

const INPUT_TABLE_CONTROL_REVEAL_PADDING_PX = 16

function isScrollableOverflow(overflow: string) {
  return overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay'
}

function canScrollElementVertically(element: HTMLElement) {
  const style = window.getComputedStyle(element)

  return (
    isScrollableOverflow(style.overflowY) && element.scrollHeight > element.clientHeight
  )
}

function canScrollElementHorizontally(element: HTMLElement) {
  const style = window.getComputedStyle(element)

  return (
    isScrollableOverflow(style.overflowX) && element.scrollWidth > element.clientWidth
  )
}

function revealInputTableControlInContainer(
  control: InputTableControlElement,
  container: HTMLElement
) {
  const controlRect = control.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const visibleTop = containerRect.top + INPUT_TABLE_CONTROL_REVEAL_PADDING_PX
  const visibleBottom = containerRect.bottom - INPUT_TABLE_CONTROL_REVEAL_PADDING_PX
  const visibleLeft = containerRect.left + INPUT_TABLE_CONTROL_REVEAL_PADDING_PX
  const visibleRight = containerRect.right - INPUT_TABLE_CONTROL_REVEAL_PADDING_PX

  if (canScrollElementVertically(container)) {
    if (controlRect.top < visibleTop) {
      container.scrollTop -= visibleTop - controlRect.top
    } else if (controlRect.bottom > visibleBottom) {
      container.scrollTop += controlRect.bottom - visibleBottom
    }
  }

  if (canScrollElementHorizontally(container)) {
    if (controlRect.left < visibleLeft) {
      container.scrollLeft -= visibleLeft - controlRect.left
    } else if (controlRect.right > visibleRight) {
      container.scrollLeft += controlRect.right - visibleRight
    }
  }
}

export function revealInputTableControl(control: InputTableControlElement) {
  const visited = new Set<HTMLElement>()
  let element = control.parentElement

  while (element) {
    visited.add(element)
    revealInputTableControlInContainer(control, element)
    element = element.parentElement
  }

  const scrollingElement = document.scrollingElement

  if (scrollingElement instanceof HTMLElement && !visited.has(scrollingElement)) {
    revealInputTableControlInContainer(control, scrollingElement)
  }
}

export function getInputTableControlName(control: HTMLElement) {
  if (
    control instanceof HTMLInputElement ||
    control instanceof HTMLTextAreaElement ||
    control instanceof HTMLSelectElement
  ) {
    return control.name
  }

  return control.getAttribute('name') || undefined
}

export function containsInputTableActiveElement(root: HTMLElement) {
  const activeElement = document.activeElement

  return activeElement instanceof HTMLElement && root.contains(activeElement)
}

export function hasInputTableQuickEditableAncestor(
  target: HTMLElement,
  root: HTMLElement
) {
  let element: HTMLElement | null = target

  while (element && root.contains(element)) {
    if (
      Array.from(element.classList).some((className) =>
        className.endsWith('Field--quickEditable')
      )
    ) {
      return true
    }

    if (element === root) {
      return false
    }

    element = element.parentElement
  }

  return false
}
