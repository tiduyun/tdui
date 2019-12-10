import Vue from 'vue'

import { deepClone, isEmpty, isFunction, isString, noop } from '@tdio/utils'

import { IDialogModel } from './types'

export interface AbsDialogModel<T> extends IDialogModel<T> {
  data: T;
  visible: boolean;
  $vm?: Vue;
  $parent?: Vue;
  show (info?: any, title?: string): void;
  hide (): void;
}

const def = (o: any, k: string, value: any, descriptor?: any) => Object.defineProperty(o, k, Object.assign({ value, ...descriptor }))

export class DialogModelService <T extends Kv> implements AbsDialogModel<T> {
  _pending: Array<[string, any]> = []

  $vm?: Vue
  $parent?: Vue

  visible: boolean = false
  title: string = ''
  data: T = {} as T
  primaryKey: string = 'id'

  get hasKey () {
    return !isEmpty(this.data[this.primaryKey])
  }

  /** @abstract */
  onInit = noop
  onShow = noop
  onHide = noop

  /** @constructor */
  constructor (fn: (self: AbsDialogModel<T>) => Partial<IDialogModel<T>>) {
    const impls = fn.call(this, this)
    Object.keys(impls).forEach((k) => {
      const v: any = impls[k]
      if (isFunction(v)) this._pending.push([k, v])
      else def(this, k, v, { enumerable: true, writable: true, configurable: true })
    })
  }

  $init (vm: Vue) {
    const ctx = vm.$parent

    this.$vm = vm
    this.$parent = ctx

    const pending = this._pending
    let o: [ string, any]
    while (o = pending.pop()!) def(this, o[0], o[1])

    this.onInit()

    vm.$on('show', this.onShow.bind(ctx))
    vm.$on('hide', this.onHide.bind(ctx))
  }

  parseData (data: T): T {
    return deepClone(data) as T
  }

  show (info?: any, title?: string) {
    if (isString(info)) {
      title = info
      info = undefined
    }
    if (title && isString(title)) {
      this.title = title
    }
    if (info !== undefined) {
      Vue.set(this, 'data', isEmpty(info) ? {} : this.parseData(info))
    }
    this.visible = true
  }

  hide () {
    this.visible = false
  }
}
