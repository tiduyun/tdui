/**
 * Provide decorator for Enhance Vue components with emittable APIs.
 *
 * @author Allex Wang <http://fedor.io>
 */

import { isArray, isFunction } from '@tdio/utils'
import Vue from 'vue'

declare module 'vue/types/vue' {
  interface Vue {
    dispatch: any;
    broadcast: any;
  }
}

function broadcast (this: Vue, componentName: string, eventName: string, params: any) {
  this.$children.forEach((child: any) => {
    const name = child.$options.componentName
    const args: any[] = isArray(params) ? params : [params]
    if (name === componentName) {
      child.$emit(eventName, ...args)
    } else {
      broadcast.apply(child, [componentName, eventName, params])
    }
  })
}

const Emitter: { [k: string]: any } = {
  dispatch (this: Vue, componentName: string, eventName: string, params: any) {
    let parent: any = this.$parent || this.$root
    let name = parent.$options.componentName
    while (parent && (!name || name !== componentName)) {
      parent = parent.$parent
      if (parent) {
        name = parent.$options.componentName
      }
    }
    if (parent) {
      const args: any[] = isArray(params) ? params : [params]
      parent.$emit(eventName, ...args)
    }
  },
  broadcast (this: Vue, componentName: string, eventName: string, params: any) {
    broadcast.call(this, componentName, eventName, params)
  }
}

function componentFactory <T extends VueClass<any>> (Component: T): T {
  // prototype props.
  const proto = Component.prototype

  Object.keys(Emitter).forEach((k) => {
    const descriptor = Object.getOwnPropertyDescriptor(proto, k)!
    if (!descriptor || !isFunction(descriptor.value)) {
      // methods
      Object.defineProperty(proto, k, { value: Emitter[k] })
    }
  })

  return Component
}

// decorator
export function Emittable <V extends Vue> (options?: any) {
  if (typeof options === 'function') {
    return componentFactory(options)
  }
  return function <VC extends VueClass<V>> (component: VC): VC {
    return componentFactory(component)
  }
}
