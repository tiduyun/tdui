/**
 * Some helpers with toolchains based on Vue
 *
 * @autho allex_wang
 */

import { hasOwn, isArray } from '@tdio/utils'
import Vue, { CreateElement, FunctionalComponentOptions, RenderContext, VNode } from 'vue'
import { ScopedSlot } from 'vue/types/vnode'

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
  let name = parent?.$options?.name

  while (parent != null && (!name || componentNames.indexOf(name) < 0)) {
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

export type FunctionalComponentRenderContext<Props> = Kv & Props & {
  // ref VNodeData
  attrs: Kv;
  props: Props;
  domProps?: Kv;
  slot?: string;
  scopedSlots?: Kv<ScopedSlot | undefined>;
  staticClass?: string;
  class?: any;
  staticStyle?: Kv;
  style?: string | object[] | object;
  hook?: Kv<Function>;
  on?: Kv<Function | Function[]>;
  nativeOn?: Kv<Function | Function[]>;
}

type T1<Props> = (this: RenderContext<Props>, ctx: FunctionalComponentRenderContext<Props>) => VNode
type T2<Props> = (this: RenderContext<Props>, h: CreateElement, ctx: FunctionalComponentRenderContext<Props>) => VNode
type FunctionalComponentRender<Props> = T1<Props> | T2<Props>

/**
 * Helper for create functional vue component by a plain render function
 *
 * @param {Function} A plain vue render function. with context of the props, @see <FunctionalComponentRender>, <FunctionalComponentRenderContext>
 */
export const functionalComponent = <Props> (render: FunctionalComponentRender<Props>): FunctionalComponentOptions<Props> => ({
  functional: true,
  inheritAttrs: false,
  render (h: CreateElement, context: RenderContext<Props>) {
    const { data, listeners, props, children, scopedSlots } = context
    const ctx: FunctionalComponentRenderContext<Props> = {
      ...data, // { on, attrs, staticClass, model }
      ...props,
      attrs: data.attrs || {},
      props
    }
    const scope = {
      $slots: children,
      $scopedSlots: scopedSlots,
      $listeners: listeners,
      ...context
    }
    return (render as T2<Props>).call(scope, h, ctx)
  }
}) as FunctionalComponentOptions<Props>

export const isVNode = (o: any): boolean => {
  let arr = o as VNode[]
  if (!isArray(o)) {
    if (!o || !hasOwn(o, 'tag')) {
      return false
    }
    arr = [ o as VNode ]
  }
  return !arr.some(o => !o || !hasOwn(o, 'tag'))
}

/**
 * Find vue components deeply by a specified predicate
 *
 * @param content {Vue} The root context
 */
export const findVueComponents = (o: Vue, predicate: (o: Vue) => boolean) => {
  const walk = (o: Vue, arr: Vue[]): Vue[] => o.$children.reduce((arr, n) => {
    if (predicate(n)) {
      arr.push(n)
    }
    return (walk(n, arr), arr)
  }, arr)
  return walk(o, [] as Vue[])
}
