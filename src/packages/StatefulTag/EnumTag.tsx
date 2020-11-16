import { functionalComponent } from '@/utils/vue'
import { $t } from '@tdio/locale'
import { get, hasOwn, identity, isFunction, template } from '@tdio/utils'
import { CreateElement } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { StatefulTag } from './StatefulTag'

export interface StatefulUISpec {
  variant: string;
  icon?: string;
  text?: string;
}

export type StatefulUISpecReducer <TResult = StatefulUISpec | string | undefined, T = string | number, TRef = Kv> =
  (val: T, ref?: TRef, enumPattern?: string) => TResult

type StatefulUISpecDic = Kv<StatefulUISpec | string>

function getEnumKey <T> (o: T, v: any): string | undefined {
  /* eslint-disable no-restricted-syntax */
  for (const k in o) {
    if (hasOwn(o, k) && o[k] === v) {
      return k
    }
  }
  return undefined
}

// Helper for translate enum locale text
function translateEnumText (v: string, enumNS: string) {
  const path = enumNS
    ? (template.isListValuePattern(enumNS) ? template(enumNS, v) : `${enumNS}.${v}`)
    : v
  return $t.te(path) ? $t(path) : $t(v)
}

function buildDefaultSpecReducer (dic: StatefulUISpecDic): StatefulUISpecReducer {
  return (val, ref, enumPattern) => {
    if (hasOwn(dic, val)) {
      return get(dic, val)
    }
    const k = ref && getEnumKey(ref, val)
    if (k) {
      return get(dic, k)
    }
    return undefined
  }
}

const normalizeSpecCalc = (impl: StatefulUISpecDic | StatefulUISpecReducer): StatefulUISpecReducer<StatefulUISpec> => {
  const fn = isFunction(impl)
    ? impl as StatefulUISpecReducer
    : buildDefaultSpecReducer(impl as StatefulUISpecDic)

  return (val, ref, enumPattern = '') => {
    let specs = fn(val, ref, enumPattern)
    if (!specs) {
      throw new Error(`Not a valid stateful ui spec. (value="${val}")`)
    }

    if (typeof specs === 'string') {
      const variant: string = specs
      specs = { variant }
    }
    const text = specs.text || translateEnumText(
      ref && getEnumKey(ref, val) || String(val),
      enumPattern
    )

    return { ...(specs as StatefulUISpec), text }
  }
}

@Component({
  inheritAttrs: false
})
export class EnumTag extends Vue {
  /**
   * Enum object reference
   */
  @Prop()
  enumRef!: Kv

  /**
   * Enum value
   */
  @Prop()
  value!: any

  /**
   * i18n key pattern (i18n message namespace prefix, e.g. cicd.Status)
   */
  @Prop()
  enumPattern!: string

  /**
   * Provide a spec configs dictionary or a spec-evaluate function
   */
  @Prop()
  uiSpec!: Kv<StatefulUISpec | string> | StatefulUISpecReducer

  render () {
    const {
      enumRef, value, enumPattern, $attrs
    } = this

    const reducer: StatefulUISpecReducer<StatefulUISpec> = normalizeSpecCalc(this.uiSpec)
    const specs = reducer(value, enumRef, enumPattern)

    if (!specs) {
      throw new Error(`enum ui specs not valid. (value="${value}")`)
    }

    const props = {
      ...$attrs,
      ...specs
    }

    return (
      <StatefulTag class="v-enum-status" props={props} attrs={$attrs} on={this.$listeners} />
    )
  }
}

type PropsReducer<T = Kv> = (v: T) => T

export const createEnumTagComponent = (
  enumRef: any,
  enumPattern: string,
  uiSpec: Kv<StatefulUISpec> | StatefulUISpecReducer,
  propsReducer?: PropsReducer
) => {
  // #(enumRef, uiSpec, propsReducer)
  if (typeof enumPattern !== 'string') {
    propsReducer = uiSpec as any
    uiSpec = enumPattern as any
    enumPattern = ''
  }
  propsReducer = propsReducer || identity
  return functionalComponent((h: CreateElement, statusProps: Kv) => {
    const { on, ...props } = propsReducer!(statusProps)
    return (<EnumTag enumRef={enumRef} enumPattern={enumPattern} uiSpec={uiSpec} {...props} on={on} />)
  })
}
