/** Dolg pritisk = desni klik. Vrne handlerje, ki jih razlijemo na element. */
export function longPress(
  open: (x: number, y: number) => void,
  /** daljši zamik in manjše dovoljeno drsenje uporabimo tam, kjer se tudi vleče */
  opts: { delay?: number; tolerance?: number } = {},
) {
  const delay = opts.delay ?? 450
  const tolerance = opts.tolerance ?? 8
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
      timer = window.setTimeout(() => open(start.x, start.y), delay)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (timer === null) return
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > tolerance) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  }
}
