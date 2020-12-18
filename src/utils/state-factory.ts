import {
  get, merge, pick, set, unset
} from '@tdio/utils'
import { reactSet } from './vue'

export interface IStateService<T> {
  set <T> (k: string, v: T, replace?: boolean): this;
  hmset (o: Kv, replace?: boolean): this;
  get <T> (k?: string): T | undefined;
  pick (fields: string[]): Kv;
  del (k: string): this;
  // serialize
  stringify (): string;
  // deserialize
  parse (s: string): T;
  clear (): void;
  destroy (): void;
}

export interface StateServiceOptions {
  decoder?: {
    encode (o: any): string;
    decode (s: string): any;
  };
  reducer <T> (oldState: T, newState: Partial<T>): Partial<T>;
}

/**
 * Provide generic state struct
 */

export function createState <S extends Kv> (initial: S, opts: StateServiceOptions): IStateService<S> {
  const data: S = initial
  const {
    reducer,
    decoder = {
      encode: JSON.stringify,
      decode: JSON.parse
    }
  } = opts
  return {
    hmset (o: Partial<S>, replace?: boolean): IStateService<S> {
      const t = replace ? o : reducer(data, o)
      reactSet(data, t)
      return this
    },
    set <T> (k: string, v: T, replace?: boolean): IStateService<S> {
      if (v === undefined) {
        this.del(k)
      } else {
        const t = {}
        set(t, k, v)
        reactSet(data, replace ? t : reducer(data, t))
      }
      return this
    },
    get <T> (k?: string): T | undefined {
      return k === undefined
        ? data as any
        : get<T>(data, k)
    },
    pick (fields: string[]): Kv {
      return pick<Kv, string>(data, fields)
    },
    del (k: string): IStateService<S> {
      unset(data, k)
      return this
    },
    stringify (): string {
      return decoder.encode(data)
    },
    parse (s: string): S {
      const t = decoder.decode(s)
      if (t) {
        merge(data, t)
      }
      return data
    },
    clear () {
      Object.keys(data).forEach(k => delete data[k])
    },
    destroy () {
      this.clear()
    }
  }
}
