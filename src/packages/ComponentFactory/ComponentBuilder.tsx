import { get, isFunction, isString, set } from '@tdio/utils'
import { functionalComponent } from '@tdio/vue-utils'
import { CreateElement, VNode, VueConstructor } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { getContext, registerComponent } from './Registry'

type GenericListener<T = Event> = (e: T) => void

export { registerComponent }

export type ComponentSpecListener = (e: any, model?: any) => void

export interface ComponentSpec<Props = Kv> {
  type?: string;
  component?: VueConstructor | null;
  modelKey?: string;
  model?: {
    value: any;
    callback: GenericListener;
  };
  props?: Props;
  on?: Kv<ComponentSpecListener>;
}

export interface ComponentModel extends Kv { }

@Component
export class ComponentBuilder extends Vue {
  /**
   * static helper for registry a new type of component implemention
   */
  static registerComponent = registerComponent

  @Prop({ type: Object, default: () => ({}) })
  spec!: ComponentSpec

  @Prop({ type: Object, default: () => ({}) })
  model!: ComponentModel

  /**
   * Component type been registered or a specfic implemention ctro ref,
   * With most top priority when specs.component been supplied.
   */
  @Prop({ type: [Function, String] })
  component!: string | VueConstructor

  @Prop(String)
  contextName!: string

  render () {
    return this.buildComponent(this.spec, this.model)
  }

  private resolveComponent (name: string): VueConstructor | null {
    return getContext(this.contextName).get(name) || null
  }

  private buildComponent (rawSpec: ComponentSpec, modelData: ComponentModel): VNode {
    const {
      type,
      modelKey,
      model, // handle model as a builtin property
      component,
      props = {},
      on = {},
      ...spec
    } = rawSpec

    let ctor: VueConstructor | string | null = null
    const t = this.component || component || type || null
    if (isString(t)) {
      ctor = this.resolveComponent(t as string) || t
    } else {
      ctor = t as VueConstructor
    }
    if (!ctor) {
      throw new Error(`Invalid component constructor, check component spec (component: "${t}")`)
    }

    // transform component v-model data into props & events
    const { $listeners, $attrs } = this

    const listeners = Object.keys(on).reduce((p, k) => {
      p[k] = function (e: Event) {
        on[k].apply(null, [e, modelData])
      }
      return p
    }, { ...$listeners } as Kv<GenericListener>)

    const setModelVal: GenericListener = (v) => {
      if (modelKey) {
        set(modelData, modelKey, v)
      } else if (model) {
        model.callback(v)
      }
      if (isFunction(listeners.input)) {
        listeners.input(v)
      }
    }

    const value = modelKey
      ? get(modelData, modelKey)
      : model
        ? model.value
        : props?.value

    const propsRest: Partial<ComponentSpec & { attrs: Kv; }> = {
      props: {
        ...props,
        value,
        ...$attrs
      },
      on: {
        ...listeners,
        input: setModelVal
      },
      ...spec
    }

    // patch props with attrs
    propsRest.attrs = propsRest.props

    return <ctor { ...propsRest } />
  }
}

export const buildComponent = <P, D = Kv> (spec: ComponentSpec<P>, model: ComponentModel) => {
  const rest = { spec, model }
  return functionalComponent((h: CreateElement) => (<ComponentBuilder { ...rest } />))
}
