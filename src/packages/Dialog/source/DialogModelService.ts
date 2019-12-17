import Vue from 'vue'

import { deepClone, isEmpty, isFunction, isString, noop } from '@tdio/utils'

import { IValidateRuleObject } from '../../../../types/validate'

type IGenericAction<A, T> = (arg1: A) => Promise<T>

interface IDialogModel<T> {
  [key: string]: any;
  primaryKey?: string;
  data?: T;
  visible?: boolean;
  rules?: IValidateRuleObject;
  onSubmit?: IGenericAction<Event, any>;
}

export interface IDialogModelService<V extends Vue, T> extends IDialogModel<T> {
  data: T;
  visible: boolean;
  $parent: V;
  $vm: Vue;
  init ($this: V): IDialogModel<T>;
  transform (data: T): T;
  show (info?: T, title?: string): void;
  hide (): void;
}

const def = (o: {}, k: string, value: any, descriptor?: {}) => Object.defineProperty(o, k, Object.assign({ value, ...descriptor }))

/** @abstract */
class AbsService <V, T> {
  onInit () {}
  onShow () {}
  onHide () {}
  init ($this: V): IDialogModel<T> {
    return this
  }
  transform (data: T) {
    return deepClone(data)
  }
}

export class DialogModelService <V extends Vue, T extends Kv> extends AbsService<V, T> implements IDialogModelService<V, T> {

  get hasKey () {
    return !isEmpty(this.data[this.primaryKey!])
  }

  $parent!: V
  $vm!: Vue

  visible: boolean = false
  title: string = ''
  data: T = {} as T
  primaryKey: string = 'id'

  private inited = false
  private pending: Array<() => void> = []

  /** @constructor */
  constructor (init: (this: IDialogModelService<V, T>, $this: V) => IDialogModelService<V, T> & any) {
    super()
    def(this, 'init', init.bind(this))
  }

  ready (fn: () => void) {
    if (this.inited) {
      fn()
    } else {
      this.pending.push(fn)
    }
  }

  created (vm: Vue) {
    const ctx: V = vm.$parent as V
    const impls = this.init(ctx)

    Object.keys(impls).forEach((k) => {
      const v: any = impls[k]
      if (isFunction(v)) def(this, k, v.bind(this))
      else Vue.set(this, k, v)
    })

    this.inited = true
    this.$vm = vm
    this.$parent = ctx

    vm.$on('show', this.onShow)
    vm.$on('hide', this.onHide)

    // dequeue ready cbs (fifo)
    const pending = this.pending
    while (pending.length) {
      const f = pending.shift()
      if (f) f()
    }

    this.onInit()
  }

  show (info?: T | string, title?: string) {
    if (isString(info)) {
      title = info as string
    }
    this.visible = true
    this.ready(() => {
      if (title && isString(title)) {
        this.title = title
      }
      if (info && typeof info === 'object') {
        Vue.set(this, 'data', isEmpty(info) ? {} : this.transform(info as T))
      }
    })
  }

  hide () {
    this.visible = false
  }
}
