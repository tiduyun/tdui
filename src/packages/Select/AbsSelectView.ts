import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { get, hasOwn, identity, isArray, isEmpty, isEqual, isPrimitive, isValue, set, valueEquals } from '@tdio/utils'

import { Emittable } from '@/utils/emittable'

import { IOption, Nil } from '../../types/common'

type T = any

@Component
@Emittable
export default class AbsSelectView extends Vue {
  @Prop()
  value!: T | undefined

  @Prop({ type: Array, default: () => ([]) })
  options!: T[]

  @Prop({ type: String, default: 'label' })
  propLabel!: string

  @Prop({ type: String, default: 'value' })
  propValue!: string

  @Prop({ type: Boolean, default: true })
  defaultFirstOption!: boolean

  @Prop(Boolean)
  multiple!: boolean

  @Prop()
  entity: any

  @Prop({ type: Function, default: identity })
  optionMapper!: (o: T) => any

  /* reactive properties */
  currentValue: T | Nil = undefined
  currentOptions: IOption[] = []
  currentEntity: object | undefined = undefined
  valueChecked: boolean = true

  private _kvRefs!: Kv<T>
  private _initialValue!: T | Nil

  beforeCreate () {
    this._kvRefs = {}
  }

  @Watch('value')
  valueWatchFn (val: T | undefined, oldVal?: T) {
    if (!isEqual(val, this.currentValue)) {
      this.setSelectedValue(val, true)
      this.dispatch('ElFormItem', 'el.form.change', val)
    }
  }

  @Watch('entity')
  setCurrEntity (entity: object | object[] | undefined) {
    const prev = this.currentEntity
    if (prev !== entity) {
      this.currentEntity = entity
      this.$emit('entity', entity)
      this.$emit('update:entity', entity)
    }
  }

  handleSelect (val: T | undefined) {
    this.valueChecked = true
    this.setSelectedValue(val)
  }

  /**
   * Set and emit current selected value (break reference with a shadow copy)
   *
   * @param val {any} The current selected value
   * @param skipEmit {Boolean} skip model emit (input & change events)
   */
  setSelectedValue (val: T | T[] | undefined, skipEmit?: boolean) {
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

    // is value changed indeed or initialize lifecycle
    if (isModified || (!isEmpty(v) && isEmpty(this.currentEntity))) {
      const dic = this._kvRefs
      // emit entity
      const o = this.multiple
        ? v.map((k: any) => dic[k])
        : dic[v]
      this.setCurrEntity(o)
    }
  }

  @Watch('options')
  handleOptionsChange (entities: T[], old: T[] = []) {
    if (!entities.length && !old.length) {
      return
    }

    this.parseOptions(entities)

    const options = this.currentOptions
    const { currentValue, defaultFirstOption } = this
    const initial = isValue(currentValue) ? currentValue : this._initialValue

    let v = initial
    if (options.length) {
      // Keep previous value if exists in new options (implicit match)
      // or else select first item when `defaultFirstOption`
      // tslint:disable-next-line
      const item = options.find(o => o.value === v)
      if (!item) {
        const val = options[0].value ?? undefined
        v = defaultFirstOption
          ? (this.multiple && val !== undefined ? [val] : val)
          : undefined
      } else {
        v = item.value
      }
    } else if (!isEmpty(old)) {
      // cleanup current value when reset options (means the previous items not empty)
      v = undefined
    }

    // not a valid value (not exists in options)
    this.valueChecked = initial !== v && options.length > 0

    this.setSelectedValue(v)
  }

  created () {
    this.setCurrEntity(this.entity)
    this._initialValue = this.normalizeValue(this.value)
  }

  mounted () {
    const { value, $slots, defaultFirstOption, options } = this

    // Get options by mockup slots
    if (defaultFirstOption && !isEmpty($slots.default) && !isValue(value)) {
      const v = get($slots, 'default[0].componentInstance.currentValue') // It's should be a ElOption instance
      this.setSelectedValue(v)
    } else if (!isEmpty(options)) {
      this.handleOptionsChange(options)
    }
  }

  protected getEntity (k: string) {
    return this._kvRefs[k]
  }

  private normalizeValue (v: any): any | undefined {
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

  private parseOptions (items: T[]): void {
    const dic: Kv<T> = {}
    const { propLabel, propValue, optionMapper } = this

    const options = items.reduce((r, o) => {
      o = optionMapper(o)
      const option: IOption = isPrimitive(o)
        ? { label: o, value: o }
        : { label: get(o, propLabel), value: get(o, propValue) }
      const disabled = !!get(o, 'disabled')
      if (disabled) {
        option.disabled = disabled
      }
      dic[option.value] = o
      r.push(option)
      return r
    }, [] as IOption[])

    this.currentOptions = options

    // cache the options k/v for selection `entity` sync
    this._kvRefs = dic
  }
}
