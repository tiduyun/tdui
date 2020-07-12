import { Module, Store } from 'vuex'

declare module 'vuex' {
  interface StoreOptions<S> {
    mixins?: Module<S, any>;
  }

  interface Store<S> {
    _modules: {
      get (path: string[]): Module<S, any>;
    }
    _modulesNamespaceMap: any;
  }

  interface Module<S, R> {
    _children: Kv<Module<S, R>>;
    _originalState: Kv;
    _rawModule: Module<S, R>;
    forEachChild (iterator: (childModule: Module<S, R>, key: string) => void): void;
  }
}

export type VueClass<V> = (new (...args: any[]) => V & Vue)

export interface StoreProvideItem<S> {
  ns?: string;
  store: Module<S, any>;
}

export type VuexStoreImpl<S, R = any> = Module<S, R> & {
  name?: string;
}

export type StoreProvideOption<S> = StoreProvideItem<S>
  | StoreProvideItem<S>
  | Array<VuexStoreImpl<any>>

export type VuexStore<S> = Store<S> & {
  _modules: {
    get (path: string[]): Module<S, any>
  }
  _modulesNamespaceMap: any;
} & (new <S> (...args: any[]) => Store<S>)
