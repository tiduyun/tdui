import { constant, isArray, isEmpty, isFunction, isObject, isPromise, valueEquals } from '@tdio/utils'
import { Component, Mixins, Prop, Vue, Watch } from 'vue-property-decorator'

import { IOptionEntity, OptionsProvider } from './AbsSelectView'
import Select from './Select'

const values = (o: any) => (isObject(o) ? Object.values(o) : o)
const isValueEquals = (o: any, p: any) => valueEquals(values(o), values(p))

type IOptionsLoader = (...args: any[]) => Promise<IOptionEntity[]> | IOptionEntity[]

@Component
class MixinSelect extends Vue {
  /** @abstract */
  keys: string = ''
  props: Kv = {}

  propLabel: string = 'label'
  propValue: string = 'value'

  @Prop()
  value!: any

  @Prop()
  entity!: IOptionEntity

  @Prop({ type: Function, default: constant(true) })
  optionsFilter!: (o: IOptionEntity) => boolean

  @Prop(Boolean)
  loading!: boolean

  lock: boolean = this.loading
  items: IOptionEntity[] = []

  private _inited?: boolean // duplicate initialize fetching locker
  private _pending?: IOptionsLoader

  @Watch('lock')
  emitLoading (v: boolean): void {
    this.$emit('update:loading', v)
  }

  initOptions <T> (provider: OptionsProvider, force?: boolean) {
    const { keys } = this
    const v = provider

    if (isFunction(v)) {
      const f: IOptionsLoader = (v as IOptionsLoader).bind(this)
      if (this.lock && !force) {
        this._pending = f
        return
      }

      this.lock = true

      const handleCb = (err: Error | null, r?: IOptionEntity[]) => {
        if (!err) {
          if (!isEmpty(keys)) {
            this._inited = true
          }
          this.setOptions(r || [])
        }

        this.lock = false

        const pending = this._pending
        if (pending) {
          this._pending = undefined
          if (!isValueEquals(keys, this.keys)) {
            this.initOptions(pending)
          }
        }
      }

      const r = f(keys)
      if (isPromise(r)) {
        (r as Promise<IOptionEntity[]>).then(
          arr => handleCb(null, arr),
          err => handleCb(err)
        )
      } else {
        handleCb(null, r as IOptionEntity[])
      }

    } else if (v !== this.items) {
      this.setOptions(v as IOptionEntity[])
    }
  }

  /**
   * API for retrieve select options.
   */
  load (force?: boolean) {
    this.initOptions(this.options, force)
  }

  mounted () {
    this.load(true)
    // Add a watcher to assert auto reload options
    this.$watch('keys', (v: string | Kv, p: string | Kv) => {
      if (!isEmpty(p) && this._inited && isValueEquals(v, p)) return
      this.load()
    })
    this.$watch('options', () => {
      this.load()
    })
  }

  render () {
    const {
      // attrs for internal select properties (forward)
      lock: inputLoading,

      // props
      value,
      entity,
      propLabel,
      propValue,
      items: options,

      // slots
      $slots,
      $scopedSlots,
    } = this

    const children = Object.keys($slots).map(slot => <template slot={slot}>{ $slots[slot] }</template>)

    return (
      <Select
        attrs={{
          ...this.props,
          ...this.$attrs,
          inputLoading
        }}
        props={{
          value,
          options,
          propLabel,
          propValue,
          entity,
        }}
        on={this.$listeners}
        scopedSlots={$scopedSlots}
      >
        { children }
      </Select>
    )
  }

  private setOptions (items: IOptionEntity[]): void {
    items = isArray(items) ? items : []
    this.items = items.filter(this.optionsFilter)
  }
}

export default Mixins<MixinSelect>(MixinSelect)
