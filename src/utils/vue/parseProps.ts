import { keys } from '@tdio/utils'
import { ComponentOptions, VueConstructor } from 'vue'

export interface ParsedProps {
  props: Kv;
  attrs: Kv;
}

export const parseProps = (attrs: Kv, ctor: VueConstructor & { options?: ComponentOptions<Vue> }): ParsedProps => {
  const propDefs = keys(ctor.options?.props || {}).reduce<Kv>((dic, k) => (dic[k] = 1, dic), {})
  return Object.keys(attrs).reduce<ParsedProps>((p, k) => {
    if (propDefs[k]) {
      p.props[k] = attrs[k]
    } else {
      p.attrs[k] = attrs[k]
    }
    return p
  }, { props: {}, attrs: {} })
}
