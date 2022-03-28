import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { constant, get, hasOwn, identity, isArray, isEmpty, isEqual, isFunction, isObject, isPrimitive, isValue, merge, pick, set } from '@tdio/utils'

import { Emittable } from '@/utils/emittable'

import { IOption, Nil } from '../../types/common'

type IOptionKeyType = PrimaryKey

export type TSelectedVal = IOptionKeyType | IOptionKeyType[]
export type IOptionEntity = object | string | number // object or any primitive types
export type OptionsProvider = IOptionEntity[] | ((...args: any[]) => Promise<IOptionEntity[]> | IOptionEntity[])

export interface SelectMetaProps {
  value: string;
  key?: string; // alias value, be deprecated
  label: string;
  disabled: string;
}

interface EntityStateType<T> {
  key: string;
  entity: T;
  ready?: boolean;
}

const defaultMetaProps: SelectMetaProps = { value: 'value', label: 'label', disabled: 'disabled' }

const getBusterKey = <T> (o: T): string => JSON.stringify(o)

@Component
@Emittable
export class AbsSelectView extends Vue {
  @Prop()
  value!: TSelectedVal | Nil

  @Prop()
  entity!: IOptionEntity

  @Prop({ type: [Array, Function], default: () => ([]) })
  options!: OptionsProvider

  @Prop({ type: String, default: 'label' })
  propLabel!: string

  @Prop({ type: String, default: 'value' })
  propValue!: string

  @Prop({ type: Boolean, default: true })
  defaultFirstOption!: boolean

  @Prop(Boolean)
  multiple!: boolean

  /**
   * A predicate function for options filter, to test each element of the options.
   * Return a value that coerces to true to keep the element, or to false otherwise.
   */
  @Prop({ type: Function, default: constant(true) })
  optionsFilterFunc!: (raw: IOptionEntity) => boolean

  /**
   * Cleanup the obsolete selected value
   */
  @Prop({ type: Boolean, default: true })
  cleanupObsolete!: boolean

  props: SelectMetaProps = defaultMetaProps

  /**
   * Unify meta props
   */
  get metaProps (): SelectMetaProps {
    let { props, propLabel, propValue } = this
    if (props === defaultMetaProps) {
      props = {
        ...props,
        value: propValue,
        label: propLabel
      }
    } else {
      props = {
        ...defaultMetaProps,
        ...props,
        value: props.value || props.key || defaultMetaProps.value
      }
    }
    return props
  }

  /* reactive properties */
  currentValue: TSelectedVal | Nil = this.normalizeValue(this.value)
  currentOptions: IOption[] = []

  private _refIndexes!: Map<IOptionKeyType, IOptionEntity>
  private _entityState!: EntityStateType<Many<IOptionEntity> | undefined>

  @Watch('value')
  valueWatchFn (val: TSelectedVal | Nil, oldVal?: TSelectedVal) {
    if (!isEqual(val, this.currentValue)) {
      this.setSelectedValue(val, true)
      this.dispatch('ElFormItem', 'el.form.change', val)
    }
  }

  @Watch('entity')
  setCurrEntity (entity: Many<IOptionEntity> | undefined) {
    const { ready, entity: prevEntity, key: prevKey } = this._entityState

    // calc identity entity changes buster based on current value
    const key = getBusterKey(this.currentValue)

    if (ready && key !== prevKey && prevEntity !== entity) {
      // refresh buster
      Object.assign(this._entityState, { entity, key })
      this.$emit('entity', entity)
      this.$emit('update:entity', entity)
    }
  }

  handleSelect (val: TSelectedVal | Nil) {
    this.setSelectedValue(val)
  }

  /**
   * Set and emit current selected value (break reference with a shadow copy)
   *
   * @param val {any} The current selected value
   * @param skipEmit {Boolean} skip model emit (input & change events)
   */
  setSelectedValue (val: TSelectedVal | Nil, skipEmit?: boolean) {
    const v = this.normalizeValue(val)
    const isModified = !isEqual(v, this.currentValue)

    // tslint:disable-next-line
    if (isModified) {
      const prev = this.currentValue
      this.currentValue = v
      if (!skipEmit) {
        this.$emit('input', v)
        this.$emit('change', v, prev)
      }
    }

    this.syncEntity()
  }

  @Watch('options')
  async handleOptionsChange (provider: OptionsProvider): Promise<IOption[]> {
    let rawItems: IOptionEntity[] = []

    // Handle options as a promise loader when it is function
    if (isFunction(provider)) {
      if (isFunction(this.optionsDecorator)) {
        rawItems = await this.optionsDecorator(provider) || []
      } else {
        throw new TypeError('Illegal arguments, use <AsyncSelect /> instead')
      }
    } else if (isArray(provider)) {
      rawItems = provider
    } else {
      throw new Error('The [[options]] type nerther Generator<Promise> or Array')
    }

    const lastOptions = this.currentOptions
    if (rawItems.length === 0 && lastOptions.length === 0) {
      return lastOptions
    }

    this.interSetOptions(rawItems)

    const options = this.currentOptions
    const { multiple, currentValue, defaultFirstOption, cleanupObsolete } = this

    // Keep previous value if exists in new options (implicit match)
    let v = currentValue

    // cleanup obsolete selected value
    if (cleanupObsolete && !isEmpty(v)) {
      const assert = (v: IOptionKeyType) => this._refIndexes.has(v)
      v = multiple
        ? (v as IOptionKeyType[]).filter(assert)
        : assert(v as IOptionKeyType)
          ? v : undefined
    }

    if (options.length > 0 && defaultFirstOption && isEmpty(v)) {
      // or else select first item when `defaultFirstOption`
      const firstVal = options[0].value
      v = multiple ? [firstVal] : firstVal
    }

    if (v !== currentValue) {
      this.setSelectedValue(v)
    } else {
      // emit entity additionally
      this.syncEntity()
    }

    return options
  }

  /**
   * Api method for update options provider programming manually
   *
   * @param options {OptionsProvider}
   */
  setOptions (options: OptionsProvider): Promise<IOption[]> {
    return this.handleOptionsChange(options)
  }

  beforeCreate () {
    this._refIndexes = new Map<IOptionKeyType, IOptionEntity>()
    this._entityState = {
      key: '',
      entity: undefined,
      ready: false
    }
  }

  created () {
    Object.assign(this._entityState, {
      entity: this.entity
    })
    this.setSelectedValue(this.value)
  }

  mounted (): Promise<any> {
    const { value, $slots, defaultFirstOption, options } = this

    // Get options by mockup slots
    if (defaultFirstOption && !isEmpty($slots.default) && !isValue(value)) {
      const v = get($slots, 'default[0].componentInstance.currentValue') // It's should be a ElOption instance
      this.setSelectedValue(v)
      return Promise.resolve()
    } else {
      return this.handleOptionsChange(options)
    }
  }

  protected getEntity (k: string): IOptionEntity | Nil {
    return this._refIndexes.get(k)
  }

  private normalizeValue (v: any): TSelectedVal | undefined {
    if (this.multiple) {
      if (isArray(v)) {
        return [...v]
      } else if (!isEmpty(v)) {
        return [v]
      }
      return []
    }
    return isEmpty(v) ? undefined : v
  }

  /**
   * Update internal options list
   */
  private interSetOptions (raw: IOptionEntity[]): void {
    const { metaProps, optionsFilterFunc } = this

    const dic: Map<IOptionKeyType, IOptionEntity> = new Map<IOptionKeyType, IOptionEntity>()
    const options = raw.filter(optionsFilterFunc).reduce<IOption[]>((r, o) => {
      const option: IOption<IOptionKeyType> = isPrimitive(o)
        ? { label: String(o), value: o as IOptionKeyType }
        : { label: get(o, metaProps.label)!, value: get<IOptionKeyType>(o, metaProps.value)! }

      // pick some extra properties
      if (typeof o === 'object') {
        merge(option, pick<Kv, string>(o, ['disabled', 'tooltip', 'icon']))
      }

      r.push(option)

      dic.set(option.value, o)
      return r
    }, [])

    // cache the option reference indexes
    this._refIndexes = dic

    // set entity state active
    this._entityState.ready = true

    this.currentOptions = options
  }

  private syncEntity () {
    if (!this._entityState.ready) {
      return
    }

    const v = this.currentValue
    const dic = this._refIndexes

    // normalize entity and emit
    const o = this.multiple
      ? (v as IOptionKeyType[]).map((k: IOptionKeyType) => dic.get(k)).filter(Boolean)
      : dic.get(v as IOptionKeyType)

    this.setCurrEntity(o)
  }
}
