import { css } from '@emotion/css'
import { Component, Prop, Vue } from 'vue-property-decorator'
import VueTypes from 'vue-types'

import { defaultBaseColor, defaultHighlightColor } from './Skeleton'

@Component
export class SkeletonTheme extends Vue {
  @Prop({ ...VueTypes.string, default: defaultBaseColor })
  color!: string

  @Prop({ ...VueTypes.string, default: defaultHighlightColor })
  highlightColor!: string

  render () {
    const { color, highlightColor } = this
    const themeStyles = css`
      .v-loading-skeleton {
        background-color: ${color};
        background-image: linear-gradient(
          90deg,
          ${color},
          ${highlightColor},
          ${color}
        );
      }
    `
    return <div class={ themeStyles }>{this.$slots.default}</div>
  }
}
