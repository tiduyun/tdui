import { pick } from '@tdio/utils'
import { Component, Prop, Vue } from 'vue-property-decorator'
import VueTypes from 'vue-types'

import { eventsFor } from './common'

export const RESIZER_DEFAULT_CLASSNAME = 'Resizer'

@Component
export default class Resizer extends Vue {
  @Prop(VueTypes.oneOfType([String, Object]).isRequired)
  className!: string | object

  @Prop({ ...VueTypes.func })
  fnClick!: any

  @Prop({ ...VueTypes.func })
  fnDoubleClick!: any

  @Prop({ ...VueTypes.func.isRequired })
  fnMouseDown!: any

  @Prop({ ...VueTypes.func.isRequired })
  fnTouchStart!: any

  @Prop({ ...VueTypes.func.isRequired })
  fnTouchEnd!: any

  @Prop({ ...VueTypes.oneOf(['vertical', 'horizontal']) })
  split!: 'vertical' | 'horizontal'

  @Prop()
  styles!: any

  @Prop({ ...VueTypes.string.isRequired, default: RESIZER_DEFAULT_CLASSNAME })
  resizerClassName!: string

  get props () {
    return pick(this, ['className', 'fnClick', 'fnDoubleClick', 'styles', 'fnMouseDown', 'fnTouchEnd', 'fnTouchStart', 'resizerClassName', 'split']) as any
  }

  mounted () {
    const ElResizer: HTMLElement = this.$refs.resizer as HTMLElement

    ElResizer.addEventListener(eventsFor.mouse.start, this.fnMouseDown, false)
    ElResizer.addEventListener(eventsFor.touch.start, this.fnTouchStart, false)
    ElResizer.addEventListener(eventsFor.touch.stop, this.fnTouchEnd, false)
  }

  beforeDestroy () {
    const ElResizer: HTMLElement = this.$refs.resizer as HTMLElement
    ElResizer.removeEventListener(eventsFor.mouse.start, this.fnMouseDown)
    ElResizer.removeEventListener(eventsFor.touch.start, this.fnTouchStart)
    ElResizer.removeEventListener(eventsFor.touch.stop, this.fnTouchEnd)
  }

  render () {
    const {
      className,
      fnClick,
      fnDoubleClick,
      resizerClassName,
      split,
      styles,
    } = this.props
    const classes = [resizerClassName, split, className]

    return (
      <span
        ref="resizer"
        role="presentation"
        class={classes.join(' ')}
        style={styles}
        onClick={(event: MouseEvent) => {
          if (fnClick) {
            event.preventDefault()
            fnClick(event)
          }
        }}
        onDblclick={(event: MouseEvent) => {
          if (fnDoubleClick) {
            event.preventDefault()
            fnDoubleClick(event)
          }
        }}
      />
    )
  }
}

