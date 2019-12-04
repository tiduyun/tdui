import { CreateElement } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { get } from '@tdio/utils'

import './Icon.scss'
import SvgIcon from './Svg'

const iconfontRe = /^(iconfont|td-icon|icon|el-icon)-.*/

const getIconfontBaseClass = (s: string): string => {
  const prefix = s.replace(iconfontRe, '$1')
  switch (prefix) {
    case 'iconfont':
    case 'td-icon':
    case 'icon':
      return 'iconfont'
    case 'el-icon':
    default:
      return ''
  }
}

@Component
export default class Icon extends Vue {
  name: string = 'Icon'

  @Prop({ type: String, default: '' })
  iconName!: string

  @Prop({ type: String, default: '' })
  className!: string

  @Prop(Boolean)
  disabled!: boolean

  @Prop(Boolean)
  light!: boolean

  @Prop({ type: [Object, String], default: null })
  tooltip!: Kv | string | null

  render (h: CreateElement) {
    const {
      light,
      disabled
    } = this

    const isSVG = this.isSVG()
    const iconClass = [
      this.iconClass(isSVG),
      {
        'is-light': light && !disabled,
        'is-disabled': disabled
      }
    ]

    // forward component style
    const style = get(this.$vnode, 'data.style')

    const icon = isSVG
      ? (<SvgIcon iconName={this.iconName} class={iconClass} on={this.$listeners} style={style} />)
      : (<i class={iconClass} on={this.$listeners} style={style} />)

    const tooltip = this.normalizeTooltip()

    return tooltip
      ? (<el-tooltip props={{ placement: 'top', ...tooltip, disabled }}>{ icon }</el-tooltip>)
      : icon
  }

  private normalizeTooltip (): Kv | null {
    const tooltip = this.tooltip
    if (tooltip) {
      if (typeof tooltip === 'string') {
        return { content: tooltip }
      }
      return tooltip as Kv
    }
    return null
  }

  private isSVG (): boolean {
    const name = this.iconName
    return /.svg$/.test(name) || !iconfontRe.test(name)
  }

  private iconClass (svg: boolean): string {
    let cls = 'v-icon'
    if (this.className) {
      cls += ` ${this.className}`
    }
    if (!svg) {
      cls = [cls, getIconfontBaseClass(this.iconName), this.iconName].filter(Boolean).join(' ')
    }
    return cls
  }
}
