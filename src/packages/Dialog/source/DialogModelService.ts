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

export class DialogModelService <V extends Vue, T extends Kv> implements IDialogModelService<V, T> {
  $parent!: V
  $vm!: Vue

  visible: boolean = false
  title: string = ''
  data: T = {} as T
  primaryKey: string = 'id'

  get hasKey () {
    return !isEmpty(this.data[this.primaryKey!])
  }

  /** @abstract */
  onInit = noop
  onShow = noop
  onHide = noop

  /** @constructor */
  constructor (init: (this: IDialogModelService<V, T>, $this: V) => IDialogModelService<V, T> & any) {
    this.init = init.bind(this)
  }

  init ($this: V): IDialogModel<T> {
    return this
  }

  transform (data: T) {
    return deepClone(data)
  }

  created (vm: Vue) {
    const ctx: V = vm.$parent as V
    const impls = this.init(ctx)

    Object.keys(impls).forEach((k) => {
      const v: any = impls[k]
      if (isFunction(v)) def(this, k, v)
      else def(this, k, v, { enumerable: true, writable: true, configurable: true })
    })

    this.$vm = vm
    this.$parent = ctx
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
