import { CreateElement, RenderContext, VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { truncate } from '@/utils'
import { doCopy } from '@/utils/copyText'

import { extractTooltip, TooltipOptions } from '@/utils/normalize'
import { Icon } from '../Icon'

const renderTextWithTooltip = (h: CreateElement, context: RenderContext, text: string, tooltip: TooltipOptions | null) => {
  const textNode = (<span class="v-text" { ...context.data }>{ text }</span>)
  return (
    tooltip && tooltip.content
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

  @Prop()
  tooltip!: TooltipOptions | string | boolean

  @Prop({ type: String, default: 'v-text' })
  tooltipClass!: string

  @Prop({ type: String, default: 'v-text--tooltip' })
  popperClass!: string

  @Prop({ type: Boolean, default: false })
  showCopy!: boolean

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
    const { isUnicodeLength, showCopy } = props
    const truncateLength = parseInt(props.truncateLength, 10)

    const tooltip = extractTooltip(context.props)
    let tip = ''

    if (truncateLength !== -1) {
      // truncate text
      tip = text
      text = truncate(text, {
        textLength: truncateLength,
        isUnicodeLength
      })
    } else {
      tip = text
    }

    if (tooltip && !tooltip.content) {
      tooltip.content = tip
    }

    return <span>
      {renderTextWithTooltip(h, context, text, tooltip)}
      {showCopy
        ? <el-tooltip content="复制" placement="top">
            <Icon iconName="el-icon-copy-document" class="copyBtn" style="margin-left:4px;" data-clipboard-text={tip} onClick={() => doCopy('.copyBtn')} />
          </el-tooltip>
        : null
      }
    </span>
  }
}
