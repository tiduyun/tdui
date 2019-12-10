/**
 * DOM APIs Maintains Utilities.
 *
 * @author Allex Wang (@allex)
 * MIT Licensed
 */

import Vue from 'vue'

type EventHandler = ((e: Event) => void) & ThisType<Element>

const isStandard = typeof document !== 'undefined' && !!document.addEventListener
const isServer = Vue.prototype.$isServer

/* istanbul ignore next */
export function hasClass (el: Element, cls: string): boolean {
  if (!el || !cls) return false
  if (cls.indexOf(' ') !== -1) throw new Error('className should not contain space.')
  if (el.classList) {
    return el.classList.contains(cls)
  }
  return (` ${el.className} `).indexOf(` ${cls} `) > -1
}

/* istanbul ignore next */
export function addClass (el: Element, cls: string): void {
  if (!el) return
  let curClass = el.className
  const classes = (cls || '').split(' ')

  for (let i = 0, j = classes.length; i < j; i++) {
    const clsName = classes[i]
    if (!clsName) continue

    if (el.classList) {
      el.classList.add(clsName)
    } else if (!hasClass(el, clsName)) {
      curClass += ` ${clsName}`
    }
  }
  if (!el.classList) {
    el.className = curClass
  }
}

/* istanbul ignore next */
export function removeClass (el: Element, cls: string): void {
  if (!el || !cls) return
  const classes = cls.split(' ')
  let curClass = ` ${el.className} `

  for (let i = 0, j = classes.length; i < j; i++) {
    const clsName = classes[i]
    if (!clsName) continue

    if (el.classList) {
      el.classList.remove(clsName)
    } else if (hasClass(el, clsName)) {
      curClass = curClass.replace(` ${clsName} `, ' ')
    }
  }
  if (!el.classList) {
    el.className = curClass.trim()
  }
}

export function toggleClass (element: Element, className: string) {
  if (!element || !className) {
    return
  }

  let classString = element.className
  const nameIndex = classString.indexOf(className)
  if (nameIndex === -1) {
    classString += `${className}`
  } else {
    classString = classString.substr(0, nameIndex)
      + classString.substr(nameIndex + className.length)
  }

  element.className = classString
}

const SPECIAL_CHARS_REGEXP = /([:\-_]+(.))/g
const MOZ_HACK_REGEXP = /^moz([A-Z])/

const camelCase = function (name: string): string {
  return name
    .replace(SPECIAL_CHARS_REGEXP, (_, _sep, letter, offset) => (offset ? letter.toUpperCase() : letter))
    .replace(MOZ_HACK_REGEXP, 'Moz$1')
}

export function getStyle (element: Element, styleName: string): string {
  if (!element || !styleName) return ''
  styleName = camelCase(styleName)
  if (styleName === 'float') {
    styleName = 'cssFloat'
  }
  const dv = document && document.defaultView
  const el = element as any
  try {
    if (dv) {
      const computed = dv.getComputedStyle(el, '')
      return el.style[styleName] || computed ? (computed as any)[styleName] : ''
    }
  } catch (e) {}
  return el.style[styleName]
}

/* istanbul ignore next */
export const on = (function () {
  if (!isServer && isStandard) {
    return (el: Node | null, event: string, handler: EventHandler) => {
      if (el && event && handler) {
        el.addEventListener(event, handler, false)
      }
    }
  }
  return (el: Node | null, event: string, handler: EventHandler) => {
    if (el && event && handler) {
      el.attachEvent(`on${event}`, handler)
    }
  }
}())

/* istanbul ignore next */
export const off = (function () {
  if (!isServer && isStandard) {
    return (el: Node | null, event: string, handler: EventHandler) => {
      if (el && event) {
        el.removeEventListener(event, handler, false)
      }
    }
  }
  return (el: Node | null, event: string, handler: EventHandler) => {
    if (el && event) {
      el.detachEvent(`on${event}`, handler)
    }
  }
}())

/* istanbul ignore next */
export const once = (el: Node | null, event: string, handler?: EventHandler) => {
  const listener = function (e: Event) {
    if (handler) {
      handler.bind(el)(e)
    }
    off(el, event, listener)
  }
  on(el, event, listener)
}

const docElem = document.documentElement

// Element contains another
// Purposefully self-exclusive
// As in, an element does not contain itself
export const contains: <T extends Element> (a: T, b: T | null) => boolean = (docElem.compareDocumentPosition || docElem.contains)
  ? function (a, b) {
    const adown = a.nodeType === 9 ? (a as unknown as Document).documentElement : a
    const bup = b && b.parentNode
    return a === bup || !!(bup && bup.nodeType === 1 && (
      adown.contains
        ? adown.contains(bup)
        : a.compareDocumentPosition && a.compareDocumentPosition(bup) & 16
    ))
  }
  : function (a, b: Node | null) {
    if (b) {
      while ((b = (b!.parentNode))) {
        if (b === a) return true
      }
    }
    return false
  }
