import { css, keyframes } from '@emotion/css'
import { isEmpty, isNumber } from '@tdio/utils'
import { Component, Prop, Vue } from 'vue-property-decorator'
import VueTypes from 'vue-types'

export const defaultBaseColor = '#eee'

export const defaultHighlightColor = '#f5f5f5'

export const skeletonKeyframes = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`

export const skeletonStyles = (duration: number, marginT?: number) => {
  return css`
    background-color: ${defaultBaseColor};
    background-image: linear-gradient(
      90deg,
      ${defaultBaseColor},
      ${defaultHighlightColor},
      ${defaultBaseColor}
    );
    background-size: 200px 100%;
    background-repeat: no-repeat;
    border-radius: 4px;
    display: block;
    margin-top: ${marginT}px;
    line-height: 1;
    width: 100%;
    animation: ${skeletonKeyframes} ${duration || 0}s ease-in-out infinite
  `
}

@Component
export class Skeleton extends Vue {
  @Prop({ ...VueTypes.number, default: 1 })
  count!: number

  @Prop({ ...VueTypes.number, default: 1.2 })
  duration!: number

  @Prop({ ...VueTypes.oneOfType([VueTypes.string, VueTypes.number]), default: '100%' })
  width!: number | string

  @Prop({ ...VueTypes.oneOfType([VueTypes.string, VueTypes.number]), default: '' })
  height!: number | string

  @Prop(VueTypes.oneOfType([String, Object]).def(''))
  className!: string | object

  @Prop()
  styles!: any

  @Prop({ ...VueTypes.bool, default: false })
  circle!: boolean

  @Prop({ ...VueTypes.number, default: 4 })
  marginT!: number

  render () {
    return (
      <span class="v-skeleton">{this.getElements()}</span>
    )
  }

  getElements () {
    const elements = []
    const { count, width, height, circle, className, duration, styles, marginT } = this

    for (let i = 0; i < count; i++) {
      const style: any = {}

      if (!isEmpty(width)) {
        style.width = isNumber(width) ? `${width}px` : width
      }

      if (!isEmpty(height)) {
        style.height = isNumber(height) ? `${height}px` : height
      }

      if (!isEmpty(width) && !isEmpty(height) && circle) {
        style.borderRadius = '50%'
      }

      let classes = 'v-loading-skeleton'
      if (className) {
        classes += ` ${className}`
      }

      elements.push(
        <span
          key={i}
          class={[classes, skeletonStyles(duration, marginT)]}
          style={{
            ...styles,
            ...style,
          }}
        >
          &zwnj;
        </span>
      )
    }
    return elements
  }
}
