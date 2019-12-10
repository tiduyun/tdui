import { CreateElement, RenderContext, VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { truncate } from '@/utils'
import { isEmpty, isObject, pick } from '@tdio/utils'

type TooltipOptions = Kv & Partial<{
  content: string;
  placement: string;
  popperClass: string;
}>

const normalizeTooltip = ({ props }: RenderContext): TooltipOptions => {
  let tooltip: TooltipOptions = props.tooltip || {}
  if (typeof tooltip === 'string') {
    tooltip = { content: tooltip }
  }
  if (!isObject(tooltip)) {
    tooltip = {}
  }
  return Object.assign(tooltip, pick(props, ['tooltipClass', 'popperClass', 'placement']))
}

const renderTextWithTooltip = (h: CreateElement, context: RenderContext, text: string, tooltip: TooltipOptions) => {
  const textNode = (<span class="v-text" { ...context.data }>{ text }</span>)
  return (
    tooltip.content
      ? (<el-tooltip props={tooltip}>{ textNode }</el-tooltip>)
      : textNode
  )
}

@Component({
  functional: true
})
export default class RichText extends Vue {
  @Prop(String)
  text!: string

  @Prop({ type: String, default: 'top' })
  placement!: string

  @Prop({ type: [String, Number], default: -1 })
  truncateLength!: number | string

  @Prop({ type: Boolean, default: false })
  isUnicodeLength!: boolean

  @Prop({ type: [String, Object, Boolean] })
  tooltip!: TooltipOptions | string | boolean

  @Prop({ type: String, default: 'v-text' })
  tooltipClass!: string

  @Prop({ type: String, default: 'v-text--tooltip' })
  popperClass!: string

  render (h: CreateElement, context: RenderContext) {
    const { props, slots } = context

    const getText = (): string => {
      let text = props.text
      if (!text) {
        const slot = slots().default
        text = slot && slot[0].text || ''
      }
      return text
    }

    let text = getText()
    const tooltip: TooltipOptions = normalizeTooltip(context)
    const { isUnicodeLength } = props
    const truncateLength = parseInt(props.truncateLength, 10)

    if (truncateLength !== -1) {
      // truncate text
      tooltip.content = text
      text = truncate(text, {
        textLength: truncateLength,
        isUnicodeLength
      })
    } else if (props.tooltip && !tooltip.content) {
      tooltip.content = text
    }

    return renderTextWithTooltip(h, context, text, tooltip)
  }
}
