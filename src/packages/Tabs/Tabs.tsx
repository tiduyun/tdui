import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { get } from '@tdio/utils'

import { ViewLoader } from '../Spiner'

import { ITabComponent } from '../../../types/common'

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

  render (h: CreateElement) {
    return (
      <el-tabs v-model={this.activeTab}>
        {
          this.tabs.map(tab => (
            <el-tab-pane key={tab.name} name={tab.name} label={tab.label}>
              {
                tab.name === this.activeTab ? (
                  <ViewLoader><component { ...{ is: tab.impl } } props={this.compProps(tab.name)} /></ViewLoader>
                ) : null
              }
            </el-tab-pane>
          ))
        }
      </el-tabs>
    )
  }
}
