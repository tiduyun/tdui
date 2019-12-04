import { Component, Prop, Vue } from 'vue-property-decorator'

@Component
export default class SvgIcon extends Vue {
  name: string = 'SvgIcon'

  @Prop({ type: String, default: '' })
  iconName!: string

  @Prop(String)
  className!: string

  render (h: any) {
    const svgName = `#icon-${this.iconName.replace(/.svg$/, '')}`
    const svgClass = `v-svg-icon ${this.className || ''}`.trim()
    return (
      <svg aria-hidden="true" class={svgClass} on={this.$listeners}>
        <use attrs={{ 'xlink:href': svgName }} />
      </svg>
    )
  }
}
