import Vue, { VueConstructor } from 'vue'
import { Store } from 'vuex'

import { isArray } from '@tdio/utils'

export type VueClass<V> = (new (...args: any[]) => V & Vue)

interface StoreProvideItem {
  ns?: string;
  store: any;
}

interface VuexStoreImpl {
  name?: string;
  state?: Kv,
  actions?: Kv
  mutations?: Kv
  getters?: Kv
}

interface VuexModule {
  state: any;
  _rawModule: VuexStoreImpl;
  _children: Kv<VuexModule>;
}

type StoreProvideOption = StoreProvideItem
  | StoreProvideItem[]
  | VuexStoreImpl[]

declare module 'vuex' {
  interface Store<S> {
    _modules: {
      get (path: string[]): VuexModule
    }
    _modulesNamespaceMap: any
  }
}

const isStore = (v: any): boolean => ['state', 'actions', 'mutations', 'getters'].some(k => v[k])

const parseStoreOptions = (options: StoreProvideOption): StoreProvideItem[] => {
  let list: StoreProvideItem[] = []

  if (isArray(options)) {
    list = (options as any[]).reduce((arr, o: any) => {
      arr.push(isStore(o) ? { store: o } : o as StoreProvideItem)
      return arr
    }, [] as StoreProvideItem[])
  } else {
    list.push(options as StoreProvideItem)
  }

  // Normalize store option names
  list = list.map((o) => {
    const ns: string = o.ns || o.store.name
    return { ...o, ns }
  })

  if (list.some(o => !(o.ns && isStore(o.store)))) {
    throw new Error('Illegal vuex store options.')
  }

  return list
}

const isStoreEmptyState = (o: VuexModule): boolean => !!(o.state && o.state.__empty__) // eslint-disable-line no-underscore-dangle

const lsStoreModule = (path: string[], o: VuexModule) => {
  const list: Array<[string[], VuexStoreImpl]> = []
  const f = (path: string[], o: VuexModule, level: number = 0) => {
    const children = o._children // eslint-disable-line no-underscore-dangle
    if (level++ > 0) {
      list.push([path, o._rawModule]) // eslint-disable-line no-underscore-dangle
    }
    Object.keys(children).forEach(k => f([...path, k], children[k], level))
  }
  return (f(path.slice(0), o, 0), list)
}

export function registerModules (options: StoreProvideOption, $store: Store<any>) {
  const storeList: StoreProvideItem[] = parseStoreOptions(options)
  if (!storeList.length) {
    return
  }

  storeList.forEach(({ ns = '', store }) => {
    ns.split('/').filter(Boolean).reduce((path: string[], c: string, i: number, arr: string[]) => {
      path.push(c)
      const host = $store._modules.get(path) // eslint-disable-line no-underscore-dangle
      if (i === arr.length - 1) {
        let pending: Array<[string[], VuexStoreImpl]> = []
        if (!host || isStoreEmptyState(host)) {
          pending.push([path, store])
          if (host) {
            pending = pending.concat(lsStoreModule(path, host))
            $store.unregisterModule(path)
          }
        }
        pending.forEach(([p, o]) => $store.registerModule(p, o))
      } else if (!host) {
        $store.registerModule(path, { namespaced: true, state: { __empty__: true } })
      }
      return path
    }, [])
  })
}

function componentFactory (
  Component: VueConstructor,
  options: StoreProvideOption
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

export const StoreProvide = function (options: StoreProvideOption): any {
  return function (Component: VueConstructor) {
    return componentFactory(Component, options)
  }
}
