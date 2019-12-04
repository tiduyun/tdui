import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { get, isEmpty, isPrimitive, isValue, valueEquals } from '@tdio/utils'

import { Emittable } from '@/utils/emittable'

import { IOption } from '../../../types/common'

type T = any

@Component
@Emittable
export default class AbsSelectView extends Vue {
  @Prop({ type: [String, Number, Array] })
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

  @Prop({ type: Function, default: (o: T) => o })
  optionMapper!: (o: T) => any

  currentValue: T | undefined = this.value

  kvRefs: Kv<T> = {}

  get currentOptions (): IOption[] {
    this.kvRefs = {}
    const { propLabel, propValue, kvRefs, optionMapper } = this
    return this.options.map((o: T | string) => {
      o = optionMapper(o)
      const option: IOption = isPrimitive(o)
        ? { label: o, value: o }
        : { label: get(o, propLabel), value: get(o, propValue) }
      // cache the options k/v for selection `entity` sync
      kvRefs[option.value] = o
      return option
    })
  }

  @Watch('value')
  handleChange (val: T | undefined, oldVal?: T) {
    if (val !== this.currentValue) {
      this.$emit('input', val)
      this.$emit('change', val, this.currentValue)
      this.dispatch('ElFormItem', 'el.form.change', val)
      this.currentValue = val
    }
    const o = this.kvRefs[val]
    const { entity, propValue } = this
    if (o !== entity && (isEmpty(entity) || !valueEquals(get(entity, propValue), get(o, propValue)))) {
      this.$emit('update:entity', o)
    }
  }

  @Watch('currentOptions')
  handleOptionsChange (options: IOption[], old: IOption[] = []) {
    if (!options.length && !old.length) {
      return
    }

    const { currentValue, defaultFirstOption } = this
    let v = currentValue
    if (options.length) {
      // select first item when options changed.
      if ((!isValue(v) || !options.find(o => o.value === v)) && defaultFirstOption) {
        v = options[0].value
      }
    } else if (!isEmpty(old)) {
      // cleanup current value when reset options (means the old options not empty)
      v = undefined
    }

    this.handleChange(v)
  }

  created () {
    this.currentValue = this.value
  }

  mounted () {
    const { value, $slots, defaultFirstOption } = this
    let options: IOption[]

    // trigger initial value if options not empty
    if (!isValue(value) && !isEmpty((options = this.currentOptions))) {
      this.handleOptionsChange(this.currentOptions)
    }

    // The options by mockup slots
    if (defaultFirstOption && !isEmpty($slots.default) && isEmpty(value)) {
      const v = get($slots, 'default[0].componentInstance.currentValue') // It's should be a ElOption instance
      this.handleChange(v)
    }
  }
}
