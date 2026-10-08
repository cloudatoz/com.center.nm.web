export function setupQueryFocusEvents(
  onFocus: () => void,
  windowTarget: EventTarget = window,
  documentTarget: EventTarget = document,
  getVisibilityState: () => DocumentVisibilityState = () => document.visibilityState,
) {
  const notifyWhenVisible = () => {
    if (getVisibilityState() === 'hidden') return
    onFocus()
  }

  windowTarget.addEventListener('focus', notifyWhenVisible)
  documentTarget.addEventListener('visibilitychange', notifyWhenVisible)

  return () => {
    windowTarget.removeEventListener('focus', notifyWhenVisible)
    documentTarget.removeEventListener('visibilitychange', notifyWhenVisible)
  }
}
