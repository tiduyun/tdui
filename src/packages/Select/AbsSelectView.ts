import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { constant, get, isArray, isEmpty, isEqual, isFunction, isValue } from '@tdio/utils'

import { Emittable } from '@/utils/emittable'

import { IOption, Nil } from '../../types/common'

type IOptionKeyType = PrimaryKey

export type TSelectedVal = IOptionKeyType | IOptionKeyType[]
export type IOptionEntity = Kv | string | number // object or any primitive types
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

  /* reactive properties for builtin passthrough */
  currentValue: TSelectedVal | Nil = null
  currentOptions: IOption[] = []

  private _ready!: boolean
  private _refIndexes!: Map<IOptionKeyType, IOptionEntity>
  private _entityState!: EntityStateType<Many<IOptionEntity> | undefined>

  @Watch('value')
  valueWatchFn (val: TSelectedVal | Nil, oldVal?: TSelectedVal) {
    if (!this._ready) {
      return
    }
    if (!isEqual(val, this.currentValue)) {
      this.setSelectedValue(val, true)
      this.dispatch('ElFormItem', 'el.form.change', val)
    }
  }

  @Watch('entity')
  setCurrEntity (entity: Many<IOptionEntity> | undefined) {
    if (!this._ready) {
      return
    }

    const { entity: prevEntity, key: prevKey } = this._entityState

    // calc identity entity changes buster based on current value
    const key = getBusterKey(this.currentValue)

    if (key !== prevKey && prevEntity !== entity) {
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
   * @param silent {Boolean} skip model emit (input & change events)
   */
  setSelectedValue (val: TSelectedVal | Nil, silent?: boolean) {
    const v = this.normalizeValue(val)
    const isModified = !isEqual(v, this.currentValue)

    if (isModified) {
      const prev = this.currentValue
      this.currentValue = v
      if (!silent) {
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

    if (!(rawItems.length === 0 && this.currentOptions.length === 0)) {
      // update current option list `currentOptions`
      this.interSetOptions(rawItems)
    }

    // set ready additonally
    if (!this._ready) {
      this.currentValue = this.normalizeValue(this.value)
      this._ready = true
    }

    const { multiple, currentValue, defaultFirstOption, cleanupObsolete } = this

    // normalize and cleanup
    let v = this.normalizeValue(currentValue, this.cleanupObsolete)

    const options = this.currentOptions
    if (options.length > 0 && defaultFirstOption && isEmpty(v)) {
      // Optional set initial value by first item based on `defaultFirstOption`
      const firstVal = options[0].value
      v = multiple ? [firstVal] : firstVal
    }

    // update select value (with sync entity)
    this.setSelectedValue(v)

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
      entity: undefined
    }
  }

  created () {
    // set `currentValue` initial state (not sync with prop `value`)
    this.currentValue = this.multiple ? [] : undefined
    this._entityState.entity = this.entity
  }

  mounted (): Promise<any> {
    let { value, $slots, defaultFirstOption, options } = this
    if (!isEmpty($slots.default)) {
      // Get value by mockup slots
      if (defaultFirstOption && !isValue(value)) {
        value = get($slots, 'default[0].componentInstance.currentValue') // It's should be a ElOption instance
      }
      this.setSelectedValue(value, true)
      return Promise.resolve()
    } else {
      return this.handleOptionsChange(options)
    }
  }

  protected getEntity (k: string): IOptionEntity | Nil {
    return this._refIndexes.get(k)
  }

  /**
   * Unify select value, also check the values(s) exists in options, ensure a array if multi-mode
   */
  private normalizeValue <T extends TSelectedVal | Nil> (v: T, cleanup: boolean = false): TSelectedVal | undefined {
    let parsed: TSelectedVal | undefined = v!
    const multi = this.multiple

    // normalize select value first
    if (multi) {
      if (isArray(v)) {
        parsed = v
      } else if (v != null && v !== '') {
        parsed = [v]
      } else {
        // ensure return a array in multi-mode
        parsed = []
      }
    }

    // Optional cleanup the obsoleted value(s)
    if (cleanup) {
      const assert = (v: IOptionKeyType): boolean => {
        const r = this._refIndexes.has(v)
        if (!r) {
          console.warn(`[Select] got a invalid value of ${typeof v}: ${String(v)}`)
        }
        return r
      }
      if (isArray(parsed)) {
        parsed = parsed.reduce<IOptionKeyType[]>((list, item) => {
          if (assert(item)) {
            list.push(item)
          }
          return list
        }, [])
      } else {
        parsed = assert(parsed) ? parsed : undefined
      }
    }

    return parsed
  }

  /**
   * Update internal options list
   */
  private interSetOptions (raw: IOptionEntity[]): void {
    const { metaProps, optionsFilterFunc } = this

    const indexes = new Map<IOptionKeyType, IOptionEntity>()

    const processOptions = (raw: IOptionEntity[]): IOption[] =>
      raw.filter(optionsFilterFunc).reduce<IOption[]>((r, o) => {
        const option: IOption<IOptionKeyType> = { label: '', value: '' }

        if (typeof o === 'object') {
          option.label = get<string>(o, metaProps.label, o.label)!
          if (isArray(o.options)) {
            // parse nest groups
            option.options = processOptions(o.options)
          } else {
            option.value = get<IOptionKeyType>(o, metaProps.value, o.value)!
            // pick some extra properties
            const keys = ['disabled', 'tooltip', 'icon']
            keys.forEach(k => option[k] = o[k])
          }
        } else {
          option.label = String(o)
          option.value = o as IOptionKeyType
        }

        r.push(option)
        indexes.set(option.value, o)

        return r
      }, [])

    const options = processOptions(raw)

    // cache the option reference indexes
    this._refIndexes = indexes

    this.currentOptions = options
  }

  private syncEntity () {
    if (!this._ready) {
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
