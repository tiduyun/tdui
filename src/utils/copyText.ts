import Clipboard from 'clipboard'
import { Message } from 'element-ui'

// FIX: actually clipboard extends from tiny-emitter(with all of the event apis)
interface ClipboardExt extends Clipboard {
  off (event: string, callback?: ICallback): this
}

type DestroyFunc = () => void

export function doCopy (selector: string): DestroyFunc {
  const clipboard: ClipboardExt = new (Clipboard as any)(selector)

  const destroy = () => {
    clipboard.off('error')
    clipboard.off('success')
    clipboard.destroy()
  }

  clipboard.on('success', () => {
    Message({ type: 'success', message: '复制成功' })
    destroy()
  })
  clipboard.on('error', () => {
    destroy()
  })

  return destroy
}
