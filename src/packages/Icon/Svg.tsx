import classNames from 'classnames'
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component
export default class SvgIcon extends Vue {
  name: string = 'SvgIcon'

  @Prop({ type: String, default: '' })
  iconName!: string

  @Prop()
  className!: any

  render () {
    const svgClass = classNames('v-svg-icon', this.className)
    return (
      <svg aria-hidden="true" className={svgClass} on={this.$listeners}>
        <use attrs={{ 'xlink:href': `#${this.iconName}` }} />
      </svg>
    )
  }
}
