import Vue, { VNode } from 'vue'

declare module 'vue/types/vue' {
  interface Vue {
    _attrs: any;
  }
}
