const rhtml = /<|&#?\w+;/

// We have to close these tags to support XHTML (#13200)
const wrapMap: Kv = {

  // Table parts need to be wrapped with `<table>` or they're
  // stripped to their contents when put in a div.
  // XHTML parsers do not magically insert elements in the
  // same way that tag soup parsers do, so we cannot shorten
  // this by omitting <tbody> or other required elements.
  thead: [ 1, '<table>', '</table>' ],
  col: [ 2, '<table><colgroup>', '</colgroup></table>' ],
  tr: [ 2, '<table><tbody>', '</tbody></table>' ],
  td: [ 3, '<table><tbody><tr>', '</tr></tbody></table>' ],

  $default: [ 0, '', '' ]
}

const rsingleTag = /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i
const rtagName = /<([a-z][^\/\0>\x20\t\r\n\f]*)/
const rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi

wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead
wrapMap.th = wrapMap.td

const toArray = <T> (o: { length: number; }): T[] => Array.prototype.slice.call(o) as T[]
const htmlPrefilter = (html: string): string => html.replace(rxhtmlTag, '<$1></$2>')

function buildFragment (html: string, context: Document, selection?: Node[], ignored?: Node[]): Node {
  let tmp, tag, wrap, j, i = 0

  let nodes: Node[] = []
  const fragment = context.createDocumentFragment()

  if (!rhtml.test(html)) {
    // Convert non-html into a text node
    nodes.push(context.createTextNode(html))
  } else {
    // Convert html into DOM nodes
    tmp = tmp || fragment.appendChild(context.createElement('div'))

    // Deserialize a standard representation
    tag = (rtagName.exec(html) || ['', ''])[1].toLowerCase()
    wrap = wrapMap[tag] || wrapMap.$default
    tmp!.innerHTML = wrap[1] + htmlPrefilter(html) + wrap[2]

    j = wrap[0]
    while (j--) {
      tmp = tmp!.lastChild
    }

    nodes = nodes.concat(toArray(tmp!.childNodes))
    tmp = fragment.firstChild
    tmp!.textContent = ''
  }

  fragment.textContent = ''

  let el: Node | null

  i = 0
  while ((el = nodes[i++])) {
    // Skip elements already in the context collection (trac-4087)
    if (selection && selection.includes(el)) {
      if (ignored) {
        ignored.push(el)
      }
      continue
    }

    fragment.appendChild(el)
  }

  return fragment
}

// Argument "data" should be string of html
// context (optional): If specified, the fragment will be created in this context,
// defaults to document
export const parseHTML = (data: string, context: Document): Node[] => {
  if (typeof data !== 'string') {
    return []
  }

  if (!context) {
    // Stop scripts or inline event handlers from being executed immediately
    // by using document.implementation
    context = document.implementation.createHTMLDocument('')

    // Set the base href for the created document
    // so any parsed elements with URLs
    // are based on the document's URL (gh-2965)
    const base = context.createElement('base')
    base.href = document.location.href
    context.head.appendChild(base)
  }

  const parsed = rsingleTag.exec(data)
  if (parsed) {
    return [context.createElement(parsed[1])]
  }

  return toArray(buildFragment(data, context).childNodes)
}
