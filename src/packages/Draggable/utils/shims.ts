import VueTypes, { VueTypeDef } from 'vue-types'

type ValidatorFunction<T> = (value: T) => boolean

// @flow
export function findInArray (array: any[] | TouchList, callback: Function): any {
  for (let i = 0, length = array.length; i < length; i++) {
    if (callback.apply(callback, [array[i], i, array])) return array[i]
  }
}

export function isFunction (func: any): boolean {
  return typeof func === 'function' || Object.prototype.toString.call(func) === '[object Function]'
}

export function isNum (num: any): boolean {
  return typeof num === 'number' && !isNaN(num)
}

export function int (a: string): number {
  return parseInt(a, 10)
}

export function dontSetMe <T> (propsName: any): VueTypeDef<T> {
  /* tslint:disable: variable-name */
  const failed_prop_type: ValidatorFunction<T> = (val: T) => !propsName
  const message = `Invalid prop ${propsName} passed to component\`s node - do not set this, set it on the child.`
  /* tslint:disable: variable-name */
  return VueTypes.custom(failed_prop_type, message)
}

export function prop_is_not_node (node: any) {
  return node.nodeType === 1
}
