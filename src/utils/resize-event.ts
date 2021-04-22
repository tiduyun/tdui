// TODO: use import when https://github.com/que-etc/resize-observer-polyfill/issues/80 been fixed
// tslint:disable-next-line
const ResizeObserver = require('resize-observer-polyfill')

type ObserverNode = Element & {
  __resizeListeners__: EventListener[];
  __ro__: ResizeObserver;
}

/* istanbul ignore next */
const resizeHandler = (entries: any[]) => {
  for (const entry of entries) {
    const listeners = entry.target.__resizeListeners__ || []
    if (listeners.length) {
      listeners.forEach((fn: () => void) => fn())
    }
  }
}

/* istanbul ignore next */
export const addResizeListener = (elem: Element, fn: EventListener) => {
  const element = elem as ObserverNode
  if (!element.__resizeListeners__) {
    element.__resizeListeners__ = []
    element.__ro__ = new ResizeObserver(resizeHandler)
    element.__ro__.observe(element as Element)
  }
  element.__resizeListeners__.push(fn)
}

/* istanbul ignore next */
export const removeResizeListener = (elem: Element, fn: EventListener) => {
  const element = elem as ObserverNode
  if (!element || !element.__resizeListeners__) return
  element.__resizeListeners__.splice(element.__resizeListeners__.indexOf(fn), 1)
  if (!element.__resizeListeners__.length) {
    element.__ro__.disconnect()
  }
}
