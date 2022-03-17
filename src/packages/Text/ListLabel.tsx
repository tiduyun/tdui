import { CreateElement, RenderContext, VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { truncate } from '@/utils'
import { isEmpty } from '@tdio/utils'

type ListIterateeRender<T> = (item: T, h: CreateElement) => VNode | string

const defaultItemRender: ListIterateeRender<any> = (o, h) => o

@Component({
  functional: true
})
export default class ListLabel <D = string | {}> extends Vue {
  @Prop({ type: String, default: 'top' })
  placement!: string

  @Prop({ type: Array, default: () => ([]) })
  items!: D[]

  @Prop({
    type: Function,
    default: defaultItemRender
  })
  itemRender!: ListIterateeRender<D>

  @Prop({ type: String, default: '-' })
  label!: string

  @Prop({ type: String, default: 'v-list-label' })
  tooltipClass!: string

  @Prop({ type: String, default: 'v-list-label-tooltip' })
  popperClass!: string

  render (h: CreateElement, context: RenderContext) {
    const { props } = context
    const { items, tooltipClass, popperClass, label, placement, itemRender } = props
    const text = !isEmpty(items) ? itemRender(items[0], h) : label

    return (items.length > 1)
      ? (
        <el-tooltip placement={placement} class={tooltipClass} popperClass={popperClass}>
          <div slot="content">
            { items.map((s: D) => (<dd>{ itemRender(s, h) }</dd>)) }
          </div>
          <span>{ text }</span>
        </el-tooltip>
      )
      : (<span>{ text }</span>)
  }
}
