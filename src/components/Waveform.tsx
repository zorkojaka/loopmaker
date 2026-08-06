/** Valovna oblika posnetka — vrhovi so izračunani ob snemanju in shranjeni z loopom. */
export function Waveform({ peaks }: { peaks: number[] }) {
  if (!peaks.length) return <div className="wave wave--empty">ni posnetka</div>
  const max = Math.max(0.05, ...peaks)
  return (
    <div className="wave">
      {peaks.map((p, i) => (
        <i key={i} style={{ height: `${Math.max(4, (p / max) * 100)}%` }} />
      ))}
    </div>
  )
}
