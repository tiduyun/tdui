import Vue, { VueConstructor } from 'vue'
import { Module, Store } from 'vuex'

import { isArray } from '@tdio/utils'
import { IModule, StoreProvideItem, StoreProvideOption, VuexStoreImpl } from './types'

const isStore = (v: any): boolean => ['state', 'actions', 'mutations', 'getters'].some(k => v[k])

const parseStoreOptions = <S> (options: StoreProvideOption<S>): Array<StoreProvideItem<S>> => {
  let list: Array<StoreProvideItem<S>> = []

  if (isArray(options)) {
    list = (options as any[]).reduce((arr, o: any) => {
      arr.push(isStore(o) ? { store: o } : o as StoreProvideItem<S>)
      return arr
    }, [] as Array<StoreProvideItem<S>>)
  } else {
    list.push(options as StoreProvideItem<S>)
  }

  // Normalize store option names
  list = list.map((o) => {
    const ns: string = o.ns || (o.store as VuexStoreImpl<S>).name!
    return { ...o, ns }
  })

  if (list.some(o => !(o.ns && isStore(o.store)))) {
    throw new Error('Illegal vuex store options.')
  }

  return list
}

const isStoreEmptyState = <S, R>(o: Module<S, R>): boolean => !!(o.state && (o.state as any).__empty__) // eslint-disable-line no-underscore-dangle

const lsStoreModule = <S, R>(path: string[], o: IModule<S, any>) => {
  const list: Array<[string[], Module<S, any>]> = []
  const f = (path: string[], o: IModule<S, R>, level: number = 0) => {
    const children = o._children // eslint-disable-line no-underscore-dangle
    if (level++ > 0) {
      list.push([path, o._rawModule]) // eslint-disable-line no-underscore-dangle
    }
    Object.keys(children).forEach(k => f([...path, k], children[k], level))
  }
  return (f(path.slice(0), o, 0), list)
}

export function registerModules <S> (options: StoreProvideOption<S>, $store: Store<S>) {
  const storeList: Array<StoreProvideItem<S>> = parseStoreOptions(options)
  if (!storeList.length) {
    return
  }

  storeList.forEach(({ ns = '', store }) => {
    ns.split('/').filter(Boolean).reduce((path, c, i, arr) => {
      path.push(c)
      const host = $store._modules.get(path) // eslint-disable-line no-underscore-dangle
      if (i === arr.length - 1) {
        let pending: Array<[string[], Module<any, S>]> = []
        if (!host || isStoreEmptyState(host)) {
          pending.push([path, store])
          if (host) {
            pending = pending.concat(lsStoreModule(path, host))
            $store.unregisterModule(path)
          }
        }
        pending.forEach(([p, o]) => $store.registerModule(p, o))
      } else if (!host) {
        $store.registerModule(path, { namespaced: true, state: { __empty__: true } } as any)
      }
      return path
    }, [] as string[])
  })
}

function componentFactory <S> (
  Component: VueConstructor,
  options: StoreProvideOption<S>
): VueClass<Vue> {
  // prototype props.
  const proto = Component.prototype

  const descriptor = Object.getOwnPropertyDescriptor(proto, 'beforeCreate')!
  const oldFn = descriptor && descriptor.value

  const createdImpl = function (this: Vue, ..._args: any[]) {
    const $store = this.$store
    if ($store) {
      registerModules(options, $store)
    } else {
      throw new Error('Register vuex module failed, The root store unavailable.')
    }
  }

  const fn = typeof oldFn === 'function' ? function (this: Vue, ...args: any[]) {
    createdImpl.call(this, ...args)
    oldFn.call(this, ...args)
  } : createdImpl

  // methods
  Object.defineProperty(proto, 'beforeCreate', { value: fn })

  return Component
}

export const StoreProvide = function <S> (options: StoreProvideOption<S>): any {
  return function (Component: VueConstructor) {
    return componentFactory(Component, options)
  }
}
