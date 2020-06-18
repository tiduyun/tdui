import { CreateElement } from 'vue'
import { Component, Mixins, Prop, Vue, Watch } from 'vue-property-decorator'

import { debounce } from '@/utils/decorators'
import { constant, isArray, isEmpty, isFunction, isObject, isPromise, valueEquals } from '@tdio/utils'

import Select from './Select'

const values = (o: any) => (isObject(o) ? Object.values(o) : o)
const isValueEquals = (o: any, p: any) => valueEquals(values(o), values(p))

type TValue = any
type TOptionEntity = object

type AsyncOptionFunc = (this: any, args: Kv | string) => Promise<TOptionEntity[]>
type SyncOptionFunc = (this: any, args: Kv | string) => TOptionEntity[]
type IOptionsFunc = AsyncOptionFunc | SyncOptionFunc
type IOptionsType = TOptionEntity[] | IOptionsFunc | null

@Component
class MixinSelect extends Vue {
  /** @abstract APIs must be implemented */
  keys: string = ''
  options!: IOptionsType
  props: Kv = {}

  propLabel: string = 'label'
  propValue: string = 'value'

  @Prop()
  value!: TValue

  @Prop()
  entity!: TOptionEntity

  @Prop({ type: Function, default: constant(true) })
  optionsFilter!: (o: TOptionEntity) => boolean

  @Prop(Boolean)
  loading!: boolean

  lock: boolean = this.loading
  items: TOptionEntity[] = []

  private _inited: boolean = false // duplicate initialize fetching locker
  private _pendingFn: IOptionsFunc | null = null

  @Watch('options')
  initOptions (options: IOptionsType, p?: IOptionsType) {
    const { keys } = this
    const v = options

    if (isFunction(v)) {
      const f: IOptionsFunc = (v as IOptionsFunc).bind(this)
      if (this.lock) {
        this._pendingFn = f
        return
      }

      this.setLoading(true)

      const handleCb = (err: Error | null, r?: TOptionEntity[]) => {
        if (!err) {
          if (!isEmpty(keys)) {
            this._inited = true
          }
          this.setOptions(r || [])
        }
        this.setLoading(false)
        const pending = this._pendingFn
        if (pending) {
          this._pendingFn = null
          if (!isValueEquals(keys, this.keys)) {
            this.initOptions(pending)
          }
        }
      }

      const r = f(keys)
      if (isPromise(r)) {
        (r as ReturnType<AsyncOptionFunc>).then(
          arr => handleCb(null, arr),
          err => handleCb(err)
        )
      } else {
        handleCb(null, r as ReturnType<SyncOptionFunc>)
      }

    } else if (v !== this.items) {
      this.setOptions(v as TOptionEntity[])
    }

    if (this.options !== options) {
      // cache it
      this.options = options
    }
  }

  /**
   * API for retrieve select options.
   */
  load () {
    this.initOptions(this.options)
  }

  mounted () {
    this.load()
    // Add a watcher to assert auto reload options
    this.$watch('keys', (v: string | Kv, p: string | Kv) => {
      if (!isEmpty(p) && this._inited && isValueEquals(v, p)) return
      this.load()
    })
  }

  render (h: CreateElement) {
    const { $slots, $scopedSlots } = this
    const {
      value,
      items: options,
      $attrs: attrs,
    } = this
    const children = Object.keys($slots).map(slot => <template slot={slot}>{ $slots[slot] }</template>)
    return (
      <Select
        {
          ...{
            attrs: {
              ...this.props,
              ...attrs,
              inputLoading: this.lock
            }
          }
        }
        options={options}
        propLabel={this.propLabel}
        propValue={this.propValue}
        value={value}
        entity={this.entity}
        on={this.$listeners}
        slots={$slots}
        scopedSlots={$scopedSlots}
      >
        { children }
      </Select>
    )
  }

  private setLoading (v: boolean): void {
    this.lock = v
    this.$emit('update:loading', v)
  }

  private setOptions (items: TOptionEntity[]): void {
    items = isArray(items) ? items : []
    this.items = items.filter(this.optionsFilter)
  }
}

export default Mixins<MixinSelect>(MixinSelect)
