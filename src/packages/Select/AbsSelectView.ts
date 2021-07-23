import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { get, hasOwn, identity, isEmpty, isPrimitive, isValue, set, valueEquals } from '@tdio/utils'

import { Emittable } from '@/utils/emittable'

import { IOption, Nil } from '../../types/common'

import { createRef, installRef, RefObject } from '../../utils/directives/ref'

type T = any

const normalizeValue = (v: any) => v === '' ? undefined : v

Vue.use(installRef)

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

  @Prop()
  entity: any

  @Prop({ type: Function, default: identity })
  optionMapper!: (o: T) => any

  /* reactive properties */
  currentValue: T | Nil = undefined
  currentOptions: IOption[] = []
  valueChecked: boolean = true

  protected selectRef!: RefObject<AbsSelectView, Vue>

  private _kvRefs!: Kv<T>
  private _initialValue!: T | Nil

  beforeCreate () {
    this._kvRefs = {}
    this.selectRef = createRef()
  }

  @Watch('value')
  handleChange (val: T | undefined, oldVal?: T) {
    oldVal = this.currentValue
    if (val !== oldVal) {
      this.setSelectedValue(val)
    }
  }

  handleSelect (val: T | undefined) {
    this.valueChecked = true
    this.setSelectedValue(val)
  }

  setSelectedValue (val: T | undefined) {
    const v = normalizeValue(val)
    const isModified = v !== this.currentValue
    const dic = this._kvRefs

    // tslint:disable-next-line
    if (isModified) {
      const prev = this.currentValue
      this.currentValue = v

      // tslint:disable-next-line
      if (val !== this.value) { // prevent cycle rollback emits
        this.$emit('input', v)
        this.$emit('change', v, prev)
        this.dispatch('ElFormItem', 'el.form.change', v)
      }
    }

    // is value changed indeed or initialize lifecycle
    if (isModified || !hasOwn(this, '_currEntity')) {
      // emit entity
      const o = dic[v]
      const { entity, propValue } = this
      if (o !== entity && (isEmpty(entity) || !valueEquals(get(entity, propValue), get(o, propValue)))) {
        set(this, '_currEntity', o)
        this.$emit('update:entity', o)
      }
      this.$emit('entity', o)
    }
  }

  @Watch('options')
  handleOptionsChange (entities: T[], old: T[] = []) {
    if (!entities.length && !old.length) {
      return
    }

    this.parseOptions(entities)

    const options = this.currentOptions
    const { currentValue, defaultFirstOption, $attrs } = this
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
          ? ($attrs.multiple && val !== undefined ? [val] : val)
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
    this._initialValue = normalizeValue(this.value)
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
