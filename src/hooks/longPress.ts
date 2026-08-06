/** Dolg pritisk = desni klik. Vrne handlerje, ki jih razlijemo na element. */
export function longPress(open: (x: number, y: number) => void) {
  let timer: number | null = null
  let start = { x: 0, y: 0 }

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return
      start = { x: e.clientX, y: e.clientY }
      cancel()
      timer = window.setTimeout(() => open(start.x, start.y), 450)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (timer === null) return
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  }
}
