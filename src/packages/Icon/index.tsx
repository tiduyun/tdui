import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { get, isEmpty } from '@tdio/utils'

import { extractTooltip } from '@/utils/normalize'

import { result } from '../../utils'
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

const stripClassNames = (classNames: string): string => {
  // remove dot tailings
  return classNames.split(' ').map(s => s.replace(/\..*$/, '')).join(' ')
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
    const isSVG = this.isSVG()

    const iconClass = [
      this.iconClass(isSVG),
      {
        'is-light': light && !disabled,
        'is-disabled': disabled,
        'is-active': active && !disabled,
        'is-button': isBtnStyle
      }
    ]

    // forward component style
    const style = get(this.$vnode, 'data.style')

    const icon = isSVG
      ? (<SvgIcon iconName={this.iconName} className={iconClass} on={listeners} style={style} />)
      : (<i className={iconClass} on={listeners} style={style} />)

    // Provide tooltip prop configs or tooltip slot impls
    return hasTooltip
      ? (<el-tooltip props={{ ...tooltip, disabled }}>
          { icon }
          { tooltipNode && (<template slot="content">{ tooltipNode }</template>) }
        </el-tooltip>)
      : icon
  }

  private isSVG (): boolean {
    const name = this.iconName
    return /.svg$/.test(name) || !iconfontRe.test(name)
  }

  private iconClass (svg: boolean): string {
    const classBase = 'v-icon'
    const { iconName, className } = this
    const classNames = [classBase]
    if (className) {
      classNames.push(className)
    }
    if (svg) {
      classNames.push(`${classBase}--${iconName}`)
    } else {
      classNames.push(getIconfontBaseClass(iconName), iconName)
    }
    return stripClassNames(classNames.filter(Boolean).join(' '))
  }
}
