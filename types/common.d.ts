/// <reference types="@tdio/utils" />

import Vue from 'vue'

export interface IOption<T = any> extends Kv {
  label: string;
  value: T;
}

export interface ITextOption extends Kv {
  text: string;
  value: string;
}

export interface ITabComponent {
  name: string;
  label: string;
  impl: string | Vue;
}

export interface IProps extends Kv {
  label: string;
  key: string;
}
