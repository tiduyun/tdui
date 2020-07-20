import { Module, Store } from 'vuex'

export interface IModule<S, R> extends Module<S, R> {
  _children: Kv<IModule<S, R>>;
  _originalState: Kv;
  _rawModule: IModule<S, R>;
  forEachChild (iterator: (childModule: IModule<S, R>, key: string) => void): void;
}

declare module 'vuex' {
  interface StoreOptions<S> {
    mixins?: Module<S, any>;
  }

  interface Store<S> {
    _modules: {
      root: IModule<S, any>;
      get (path: string[]): IModule<S, any>;
    }
    _modulesNamespaceMap: any;
  }

  interface Module<S, R> {
    _originalState?: Kv;
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

export type VuexStore<S> = Store<S> & (new <S> (...args: any[]) => Store<S>)
