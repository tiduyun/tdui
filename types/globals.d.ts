/// <reference path="common.d.ts" />

export {}

interface $T {
  (key: string, ...args: any[]): string;
  te (key: string): boolean;
  tc (key: string, choice?: number): string;
  d (value: number | Date, key?: string): string;
  n (value: number | Date, format?: string): string;
}

declare global {
  /* tslint:disable: no-empty-interface */
  interface Window extends Kv {}
  interface Promise<T> extends Kv {}

  // i18n helper
  const $t: $T
}
