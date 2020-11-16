import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { get } from '@tdio/utils'

import { ViewLoader } from '../Spiner'

import { ITabComponent } from '../../types/common'

@Component
export class Tabs extends Vue {
  defaultTab: string = ''

  @Prop(String)
  value!: string

  @Prop(Array)
  tabs!: ITabComponent[]

  @Prop({ type: Function, default: () => ({}) })
  compProps!: (name: string) => {}

  @Prop({ type: Boolean, default: true })
  syncRoute!: boolean

  get activeTab (): string {
    let curr = this.value || this.defaultTab
    if (this.syncRoute) {
      curr = this.$route.query.tab as string || this.defaultTab
    }
    if (this.value !== curr) {
      this.$emit('input', curr)
    }
    return curr
  }

  set activeTab (tab: string) {
    if (tab !== this.value) {
      if (this.syncRoute) {
        const query = { ...this.$route.query, tab }
        if (tab === this.defaultTab) {
          delete query.tab
        }
        this.$router.push({ query })
      }
      this.$emit('input', tab)
    }
  }

  created () {
    this.defaultTab = this.value || get(this, 'tabs[0].name') || ''
  }

  render () {
    const props = (tab: ITabComponent) => ({
      is: tab.impl,
      props: this.compProps(tab.name)
    })
    return (
      <el-tabs v-model={this.activeTab}>
        {
          this.tabs.map(t => {
            return (
              <el-tab-pane key={t.name} name={t.name} label={t.label}>
                {
                  t.name === this.activeTab && (
                    t.async === false
                      ? <component { ...props(t) } />
                      : <ViewLoader><component { ...props(t) } /></ViewLoader>
                    )
                }
              </el-tab-pane>
            )
          })
        }
      </el-tabs>
    )
  }
}
