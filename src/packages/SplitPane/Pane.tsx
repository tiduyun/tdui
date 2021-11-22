import { isNumber, pick } from '@tdio/utils'
import { CreateElement } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'
import VueTypes from 'vue-types'

@Component
export default class Pane extends Vue {
  @Prop(VueTypes.oneOfType([String, Object]).isRequired)
  className!: string | object

  @Prop({ type: Object, default: () => ({})})
  styles!: any

  @Prop(VueTypes.oneOfType([VueTypes.string, VueTypes.number]))
  size!: string | number

  @Prop(VueTypes.oneOf(['vertical', 'horizontal']))
  split!: 'vertical' | 'horizontal'

  @Prop({ ...VueTypes.string, default: '' })
  eleRef!: any

  get props () {
    return pick(this, ['className', 'size', 'split', 'eleRef', 'styles']) as any
  }

  render () {
    const {
      // children,
      className,
      split,
      styles,
      size,
      eleRef,
    } = this.props

    const classes = ['Pane', split, className]

    let style: Kv = {
      flex: 1,
      position: 'relative',
      outline: 'none',
      width: '',
      height: '',
      display: '',
    }

    if (size !== undefined) {
      if (split === 'vertical') {
        style.width = isNumber(size) ? `${size}px` : size
      } else {
        style.height = isNumber(size) ? `${size}px` : size
        style.display = 'flex'
      }
      style.flex = 'none'
    }
    style = Object.assign({}, style, styles)

    return (
      <div ref={eleRef} class={classes.join(' ')} style={style}>
        {this.$slots.default}
      </div>
    )
  }
}
