import { hasOwn } from '@tdio/utils'
import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { extractTooltip } from '../../utils/normalize'

import { Icon } from '../Icon'

import './StatefulTag.scss'

export type StatusVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | string

const icons: Kv<string> = {
  success: 'el-icon-success',
  warning: 'el-icon-warning',
  error: 'el-icon-error',
  info: 'el-icon-info',
  loading: 'el-icon-loading'
}

const variantIcons: Kv<string> = {
  danger: 'error',
  secondary: 'info'
}

const result = (o: any, ...args: any[]) => (typeof o === 'function' ? o(...args) : o)

const getIconClass = (v: string): string | undefined => icons[v]

// Return icon class name by a specific variant, returns info icon by the default
const calcIconByVariant = (variant: StatusVariant): string => {
  let icoName = 'info'
  if (hasOwn(icons, variant)) {
    icoName = variant
  } else if (hasOwn(variantIcons, variant)) {
    icoName = variantIcons[variant]!
  }
  return getIconClass(icoName)!
}

@Component({
  inheritAttrs: false
})
export class StatefulTag extends Vue {
  @Prop({ type: String, required: true })
  variant!: StatusVariant

  @Prop({ type: String })
  text!: string

  @Prop({ type: String })
  icon!: string

  @Prop({ type: Boolean })
  border!: boolean

  @Prop({ type: Boolean, default: true })
  showIcon!: boolean

  @Prop({ type: Boolean, default: true })
  showText!: boolean

  @Prop(Boolean)
  disabled!: boolean

  @Prop({ type: String, default: 'plain' })
  theme!: 'dark' | 'light' | 'plain'

  @Prop({ type: String, default: 'small' })
  size!: 'medium' | 'small' | 'mini'

  renderBadge (tooltip: boolean) {
    const {
      theme, variant, text, border, showIcon, showText, disabled, size
    } = this
    const isButtonStyle = tooltip || Object.keys(this.$listeners).some(t => t === 'click')
    const classes = [
      'v-stateful-tag',
      'el-tag',
      `el-tag--${theme}`,
      {
        [`el-tag--${variant}`]: !!variant,
        [`el-tag--${size}`]: !!size,
        'is-disabled': disabled,
        'is-button': isButtonStyle,
        'no-border': !border,
        [`${variant}`]: !!variant
      }
    ]
    const iconType = this.icon
    const iconName = iconType
      ? getIconClass(iconType) || iconType
      : calcIconByVariant(variant)
    return (
      <span class={classes}>
        {showIcon && iconName ? (<Icon class="icon" props={{ iconName, tooltip: !showText && text || null }} />) : null}
        {showText && text ? (<span class="text">{ this.text }</span>) : null}
      </span>
    )
  }

  render () {
    const {
      disabled,
      $slots: {
        tooltip: tooltipSlot // custom tooltip vnode <div slot="tooltip">tips contents</div>
      },
      $scopedSlots: {
        tooltip: tooltipScopedSlot
      }
    } = this

    const tooltip = extractTooltip({ ...this.$props, ...this.$attrs })
    const tooltipNode: VNode[] | undefined = tooltipScopedSlot
      ? result(tooltipScopedSlot, this.$props)
      : tooltipSlot
    const hasTooltip = !!(tooltipNode || tooltip && tooltip.content)

    const inter = this.renderBadge(hasTooltip)

    // Provide tooltip prop configs
    return hasTooltip
      ? (<el-tooltip props={{ ...tooltip, disabled }}>
          { inter }
          { tooltipNode && (<template slot="content">{ tooltipNode }</template>) }
        </el-tooltip>)
      : inter
  }
}
