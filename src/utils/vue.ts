/**
 * Some helpers with toolchains based on Vue
 *
 * @autho allex_wang
 */

import Vue from 'vue'

import { isArray } from '@tdio/utils'

/**
 * Find components upward
 */
export function findUpward (context: Vue, componentName: string | string[]): Vue {
  let componentNames: string[]

  if (typeof componentName === 'string') {
    componentNames = [componentName]
  } else {
    componentNames = componentName
  }

  let parent = context.$parent
  let name = parent.$options.name
  while (parent && (!name || componentNames.indexOf(name) < 0)) {
    parent = parent.$parent
    if (parent) name = parent.$options.name
  }

  return parent
}

/**
 * Find component downward
 */
export function findDownward (context: Vue, componentName: string): Vue | null {
  const childrens = context.$children
  let vnode = null

  if (childrens.length) {
    for (let i = 0, l = childrens.length; i < l;) {
      const child = childrens[i++]
      const name = child.$options.name
      if (name === componentName) {
        vnode = child
        break
      } else {
        vnode = findDownward(child, componentName)
        if (vnode) break
      }
    }
  }

  return vnode
}

export function reactSet (target: any, prop: string | Kv, v?: any) {
  if (v == null && prop && typeof prop === 'object') {
    const obj = prop as Kv
    Object.keys(obj).forEach(k => Vue.set(target, k, obj[k]))
  } else {
    Vue.set(target, prop as string, v)
  }
}

type ComposeFilterOption = [ (...args: any[]) => any, any[] ]

export function composeFilter (filters: Array<ComposeFilterOption | any>) {
  const fns: ComposeFilterOption[] = filters.map((k) => {
    const [f, ...args] = isArray(k) ? k : [k]
    if (typeof f !== 'function') {
      throw new Error(`Invalid filter. (${k})`)
    }
    return [f, args] as ComposeFilterOption
  })
  return (v: any) => fns.reduce((r, [f, args]) => f(r, ...args), v)
}
