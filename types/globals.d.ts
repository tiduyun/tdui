/// <reference path="common.d.ts" />

import Vue from 'vue'

export {}

declare global {
  /* tslint:disable: no-empty-interface */
  interface Window extends Kv {}
  interface Promise<T> extends Kv {}

  type Nil = null | undefined
  type Nullable<T> = T | null
  type VueClass<V> = (new (...args: any[]) => V & Vue) & typeof Vue
}
