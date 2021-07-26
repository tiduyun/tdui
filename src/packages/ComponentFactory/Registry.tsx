import { Input } from 'element-ui'
import { VueConstructor } from 'vue'

import { isFunction, isObject } from '@tdio/utils'
import { Button } from '../Button'
import { CheckboxGroup } from '../Checkbox/CheckboxGroup'
import { Select } from '../Select'

type ContextName = string | symbol

const assertComponentImpl = (o: VueConstructor | object | null) => {
  if (!(isFunction(o) || isObject(o))) {
    throw new Error('Invalid component implemention')
  }
}

class ComponentRegistry<T extends VueConstructor = VueConstructor> extends Map<string, T> {
  constructor (entries?: Array<readonly [string, any]> | null) {
    super(entries)
  }
  /**s
   * Helper for registry a new type of component implemention
   */
  registerComponent (type: string, componentCtor: T): void {
    assertComponentImpl(componentCtor)

    this.set(type, componentCtor)
  }
}

const defaultContext: symbol = Symbol('default')

const contexts: Record<ContextName, ComponentRegistry> = {
  [defaultContext]: new ComponentRegistry([
    ['Input', Input],
    ['Select', Select],
    ['Button', Button],
    ['CheckboxGroup', CheckboxGroup]
  ])
}

/**
 * Factory method for get a specfic component registry, return the shared builtin registry by the default.
 */
export const getContext = (name?: ContextName): ComponentRegistry => {
  if (!name) {
    name = defaultContext
  }
  return contexts[name] || (contexts[name] = new ComponentRegistry())
}

export const registerComponent = (type: string, componentCtor: VueConstructor, context?: ContextName): void => {
  const ctx = getContext(context)
  ctx.registerComponent(type, componentCtor)
}
