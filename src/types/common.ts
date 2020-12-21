import Vue from 'vue'

export type Nil = null | undefined
export type Nullable<T> = T | null
export type VueClass<V> = (new (...args: any[]) => V & Vue) & typeof Vue

export interface IOption<T = any> extends Kv {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface ITextOption extends Kv {
  text: string;
  value: string;
}

export interface ITabComponent {
  name: string;
  label: string;
  impl: string | Vue;
  async: boolean;
}

export interface IProps extends Kv {
  label: string;
  key: string;
}