import Vue from 'vue'
import { FunctionalComponentOptions, RenderContext } from 'vue/types/options'
import { NormalizedScopedSlot, VNode } from 'vue/types/vnode'

declare module 'vue/types/vue' {
  interface Vue {
    _attrs: any;
    [attr: string]: any;
    <Props> (context: RenderContext<Props>): JSX.Element;
  }
}

declare module 'vue/types/options' {
  type NormalizedScopedSlot = (props: any) => ScopedSlotChildren
  type ScopedSlotChildren = VNode[] | VNode | undefined

  interface ComponentOptions<V extends Vue> {
    [propName: string]: any;
    ref?: string;
    scopedSlots?: Kv<NormalizedScopedSlot>;
  }
}
