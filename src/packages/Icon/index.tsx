import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { get, isEmpty } from '@tdio/utils'

import { extractTooltip } from '../../utils/normalize'

import { result } from '../../utils'
import './Icon.scss'
import SvgIcon from './Svg'

const iconfontRe = /^(iconfont|td-icon|icon|el-icon)-.*/

const isFontName = (n: string) => iconfontRe.test(n)

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
export class Icon extends Vue {
  name: string = 'Icon'

  @Prop({ type: String, default: '' })
  iconName!: string

  @Prop()
  className!: any

  @Prop(Boolean)
  disabled!: boolean

  @Prop(Boolean)
  active!: boolean

  @Prop(Boolean)
  light!: boolean

  @Prop({ type: [Object, String], default: null })
  tooltip!: Kv | string | null

  @Prop(Boolean)
  svg!: boolean

  render () {
    const {
      light,
      active,
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
    const hasTooltip = tooltipNode || (tooltip && tooltip.content)

    const listeners = disabled ? {} : this.$listeners
    const isBtnStyle = hasTooltip || !isEmpty(listeners.click)

    const [name, isSvg] = this.normalizeName()

    const iconClass = [
      {
        ...this.iconClass(name, isSvg),
        'is-light': light && !disabled,
        'is-disabled': disabled,
        'is-active': active && !disabled,
        'is-button': isBtnStyle
      }
    ]

    // forward component style
    const style = get(this.$vnode, 'data.style')

    const icon = isSvg
      ? (<SvgIcon iconName={name} className={iconClass} on={listeners} style={style} />)
      : (<i className={iconClass} on={listeners} style={style} />)

    // Provide tooltip prop configs or tooltip slot impls
    return hasTooltip
      ? (<el-tooltip props={{ ...tooltip, disabled }}>
          { icon }
          { tooltipNode && (<template slot="content">{ tooltipNode }</template>) }
        </el-tooltip>)
      : icon
  }

  /**
   * Normalize icon name with font type
   *
   * @private
   * @return [name, isSvg]
   */
  private normalizeName (): [string, boolean] {
    let { svg, iconName } = this
    if (svg || isFontName(iconName)) {
      return [iconName, svg]
    }

    if (/.svg$/.test(iconName)) {
      // strip .svg suffix
      iconName = iconName.slice(0, -4)
    }

    // add prefix for svg symbolId
    return [`icon-${iconName}`, true]
  }

  private iconClass (name: string, svg: boolean): Record<string, boolean> {
    const classBase = 'v-icon'
    const dic: Record<string, boolean> = {
      [classBase]: true
    }
    if (svg) {
      dic[`${classBase}--${name}`] = true
    } else {
      dic[getIconfontBaseClass(name)] = true
      dic[name] = true
    }
    return dic
  }
}
