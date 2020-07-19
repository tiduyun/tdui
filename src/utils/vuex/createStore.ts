/* eslint-disable no-underscore-dangle */

import { deepClone } from '@tdio/utils'
import { Module, ModuleOptions, Store, StoreOptions } from 'vuex'
import { VuexStore } from './types'

type CreateContextOptions<S, R> = (StoreOptions<S> | Module<S, R>) & {
  mixins?: Kv;
}

function injectModule <S, R> (m: Module<S, R>, mixins: any = {}) {
  m._originalState = deepClone((typeof m.state === 'function' ? (m.state as () => S)() : m.state) || {})

  const { mutations, actions, getters } = mixins
  if (mutations) {
    m.mutations = { ...mutations, ...(m.mutations || {}) }
  }

  if (actions) {
    m.actions = { ...actions, ...(m.actions || {}) }
  }

  if (getters) {
    m.getters = { ...getters, ...(m.getters || {}) }
  }

  if (m.modules) {
    Object.values(m.modules).forEach(subModule => {
      injectModule(subModule, mixins)
    })
  }
}

function getOriginalState <S, R> (module: Module<S, R>, moduleVueState: Kv, options: Kv = {}, defaultReset = true) {
  if (options.self === undefined) {
    options.self = defaultReset
  }
  if (options.nested === undefined) {
    options.nested = options.self
  }
  const state = options.self ? module._rawModule._originalState : moduleVueState
  module.forEachChild((childModule, key) => {
    let nestOption = {}
    if (options.modules && options.modules[key]) {
      nestOption = { ...options.modules[key] }
    }
    state[key] = getOriginalState(childModule, moduleVueState[key], nestOption, options.nested)
  })
  return state
}

export const createStore = <S = any, R = any>(Ctor: VuexStore<S>, options: CreateContextOptions<S, R> = {}): Store<S> => {
  const mixins = options.mixins || {}

  // static module
  injectModule(options as Module<S, R>, mixins)

  const proto = Ctor.prototype

  if (!proto.reset) {
    // dynamic module
    const rawRegisterModule = proto.registerModule
    proto.registerModule = function (path: string, rawModule: Module<S, R>, options: ModuleOptions = {}) {
      injectModule(rawModule, mixins)
      rawRegisterModule.call(this, path, rawModule, options)
    }

    // reset to original state
    proto.reset = function (options?: Kv) {
      const originalState = getOriginalState(this._modules.root, deepClone(this._vm._data.$$state), options)
      this.replaceState(deepClone(originalState))
    }
  }

  return new Ctor(options as StoreOptions<S>)
}
