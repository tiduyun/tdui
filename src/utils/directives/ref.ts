import Vue, { VueConstructor } from 'vue'

export interface RefObject<C, T> {
  (context?: any): void;
  context?: C;
  current: T | null;
}

export const createRef = <C, T> (context?: C): RefObject<C, T> => {
  const ref: RefObject<C, T> = (r: T | null) => {
    ref.current = r
  }
  if (context) {
    ref.context = context
  }
  ref.current = null
  return ref
}

export const installRef = (Vue: VueConstructor<Vue>): void => {
  const directiveName = 'ref'
  Vue.directive(directiveName, {
    bind (el, binding, vnode) {
      Vue.nextTick(() => {
        binding.value(vnode.componentInstance || el, vnode.key)
      })
      binding.value(vnode.componentInstance || el, vnode.key)
    },
    update (el, binding, vnode, oldVnode) {
      const { data } = oldVnode
      if (data && data.directives) {
        const oldBinding = data.directives.find((directive) => directive.name === directiveName)
        if (oldBinding && oldBinding.value !== binding.value) {
          if (oldBinding) {
            oldBinding.value(null, oldVnode.key)
          }
          binding.value(vnode.componentInstance || el, vnode.key)
          return
        }
      }
      // Should not have this situation
      if (
        vnode.componentInstance !== oldVnode.componentInstance ||
        vnode.elm !== oldVnode.elm
      ) {
        binding.value(vnode.componentInstance || el, vnode.key)
      }
    },
    unbind (_el, binding, vnode) {
      binding.value(null, vnode.key)
    }
  })
}
