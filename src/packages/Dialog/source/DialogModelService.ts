import Vue from 'vue'

import { deepClone, isEmpty, isFunction, isString, noop } from '@tdio/utils'

import { IDialogModel } from './types'

type DataTransform <D> = (this: IDialogModelService<D>, d: D) => D

export interface IDialogModelService<T> extends IDialogModel<T> {
  $vm: Vue;
  $parent: Vue;
  primaryKey: string;
  data: T;
  visible: boolean;
  transform: DataTransform<T>;
  show (info?: T, title?: string): void;
  hide (): void;
}

const def = (o: {}, k: string, value: any, descriptor?: {}) => Object.defineProperty(o, k, Object.assign({ value, ...descriptor }))

export class DialogModelService <T extends Kv> implements IDialogModelService<T> {
  _pending: Array<[string, any]> = []

  $vm!: Vue
  $parent!: Vue

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
  constructor (fn: <M = any> (self: IDialogModelService<T> & M) => IDialogModel<T> & M) {
    const impls = fn.call(this, this)
    Object.keys(impls).forEach((k) => {
      const v: any = impls[k]
      if (isFunction(v)) this._pending.push([k, v])
      else def(this, k, v, { enumerable: true, writable: true, configurable: true })
    })
  }

  transform (data: T) {
    return deepClone(data)
  }

  created (vm: Vue) {
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

  show (info?: T | string, title?: string) {
    if (isString(info)) {
      title = info as string
    }
    if (title && isString(title)) {
      this.title = title
    }
    if (info && typeof info === 'object') {
      Vue.set(this, 'data', isEmpty(info) ? {} : this.transform(info as T))
    }
    this.visible = true
  }

  hide () {
    this.visible = false
  }
}
