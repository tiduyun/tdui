export {}

declare global {
  /* tslint:disable: no-empty-interface */
  interface Window extends Kv {}
  interface Promise<T> extends Kv {}
}
