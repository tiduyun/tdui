import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import VueTypes from 'vue-types'

import type {DraggableData, DraggableEventHandler} from './types'

export const defaultDraggableEventHandler = (e: MouseEvent, data: DraggableData): void | boolean => true

import { dontSetMe, prop_is_not_node } from './shims'

@Component
export class PropsMixins extends Vue {
  /**
   * `allowAnyClick` allows dragging using any mouse button.
   * By default, we only accept the left button.
   *
   * Defaults to `false`.
   */
  @Prop({ ...VueTypes.bool, default: false })
  allowAnyClick!: boolean

  /**
   * `disabled`, if true, stops the <Draggable> from dragging. All handlers,
   * with the exception of `fnMouseDown`, will not fire.
   */
  @Prop({ ...VueTypes.bool, default: false })
  disabled!: boolean

  /**
   * By default, we add 'user-select:none' attributes to the document body
   * to prevent ugly text selection during drag. If this is causing problems
   * for your app, set this to `false`.
   */
  @Prop({ ...VueTypes.bool, default: true })
  enableUserSelectHack!: boolean

  /**
   * ` v`, if set, uses the passed DOM node to compute drag offsets
   * instead of using the parent node.
   */
  @Prop(VueTypes.custom(prop_is_not_node, 'Draggable\'s offsetParent must be a DOM Node.'))
  offsetParent!: HTMLElement

  /**
   * `grid` specifies the x and y that dragging should snap to.
   */
  @Prop({ ...VueTypes.arrayOf(VueTypes.number), default: null })
  grid!: number[]

  /**
   * `handle` specifies a selector to be used as the handle that initiates drag.
   *
   * Example:
   *
   * ```jsx
   *   let App = React.createClass({
   *       render: function () {
   *         return (
   *            <Draggable handle=".handle">
   *              <div>
   *                  <div className="handle">Click me to drag</div>
   *                  <div>This is some other content</div>
   *              </div>
   *           </Draggable>
   *         );
   *       }
   *   });
   * ```
   */
  @Prop({ ...VueTypes.string, default: null })
  handle!: string

  /**
   * `cancel` specifies a selector to be used to prevent drag initialization.
   *
   * Example:
   *
   * ```jsx
   *   let App = React.createClass({
   *       render: function () {
   *           return(
   *               <Draggable cancel=".cancel">
   *                   <div>
   *                     <div className="cancel">You can't drag from here</div>
   *                     <div>Dragging here works fine</div>
   *                   </div>
   *               </Draggable>
   *           );
   *       }
   *   });
   * ```
   */
  @Prop({ ...VueTypes.string, default: null })
  cancel!: string
  /**
   * Called when dragging starts.
   * If this function returns the boolean false, dragging will be canceled.
   */
  @Prop({ ...VueTypes.func, default: defaultDraggableEventHandler })
  fnStart!: DraggableEventHandler

  /**
   * Called while dragging.
   * If this function returns the boolean false, dragging will be canceled.
   */
  @Prop({ ...VueTypes.func, default: defaultDraggableEventHandler })
  fnDrag!: DraggableEventHandler

  /**
   * Called when dragging stops.
   * If this function returns the boolean false, the drag will remain active.
   */
  @Prop({ ...VueTypes.func, default: defaultDraggableEventHandler })
  fnStop!: DraggableEventHandler

  /**
   * A workaround option which can be passed if fnMouseDown needs to be accessed,
   * since it'll always be blocked (as there is internal use of fnMouseDown)
   */
  @Prop({ ...VueTypes.func, default: (e: MouseEvent) => {} })
  fnMouseDown!: (e: MouseEvent) => void

  /**
   * These properties should be defined on the child, not here.
   */
  @Prop({ ...VueTypes.number, default: 1 })
  scale!: number

  @Prop(dontSetMe('className'))
  className!: any

  @Prop(dontSetMe('transform'))
  transform!: any

  @Prop(dontSetMe('styles'))
  styles!: any
}
