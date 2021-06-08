export type ResizeHandleAxis =
  | 's'
  | 'w'
  | 'e'
  | 'n'
  | 'sw'
  | 'nw'
  | 'se'
  | 'ne'
export type ResizeHandle =
  | Element
  | ((
      resizeHandleAxis: ResizeHandleAxis,
      ref: HTMLElement
    ) => Element)
