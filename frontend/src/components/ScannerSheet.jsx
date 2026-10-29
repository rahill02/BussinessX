import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet.jsx'
import TextField from './TextField.jsx'
import Button from './Button.jsx'
import Banner from './Banner.jsx'

// Camera scanning uses the browser's built-in BarcodeDetector, so no extra library is needed.
// It exists on Chrome for Android and some other browsers; everywhere else the number can be typed,
// or read by a USB/Bluetooth barcode scanner (those just type the digits and press Enter).
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']
const cameraWorks = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia

export default function ScannerSheet({ onCode, onClose }) {
  const video = useRef(null)
  const [typed, setTyped] = useState('')
  const [problem, setProblem] = useState(null)

  useEffect(() => {
    if (!cameraWorks) return
    let stream
    let timer
    let stopped = false

    async function start() {
      try {
        // back camera first; the picture stays on this phone
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        video.current.srcObject = stream
        await video.current.play()
        const supported = await window.BarcodeDetector.getSupportedFormats()
        const detector = new window.BarcodeDetector({ formats: FORMATS.filter((f) => supported.includes(f)) })
        timer = setInterval(async () => {
          try {
            const codes = await detector.detect(video.current)
            if (codes.length > 0 && !stopped) {
              stopped = true
              onCode(codes[0].rawValue)
            }
          } catch {
            // a frame that cannot be read is skipped; the next one is tried
          }
        }, 300)
      } catch {
        setProblem('The camera could not be opened. Allow camera access for this site, or type the number below.')
      }
    }
    start()

    return () => {
      stopped = true
      clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit() {
    const code = typed.replace(/\s+/g, '')
    if (code.length >= 3) onCode(code)
  }

  return (
    <Sheet title="Scan barcode" subtitle="Hold the barcode inside the box" onClose={onClose}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
        {cameraWorks ? (
          <div className="relative overflow-hidden rounded-3xl bg-ink-950">
            <video ref={video} muted playsInline className="aspect-[4/3] w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-2xl border-2 border-white/80" />
          </div>
        ) : (
          <Banner tone="info">
            This browser cannot read barcodes with the camera. Type the number below, or use a barcode scanner: it types
            the number for you.
          </Banner>
        )}
        {problem && <Banner tone="warn">{problem}</Banner>}

        <TextField
          label="Or type the number"
          inputMode="numeric"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="e.g. 8901058000290"
        />
        <Button onClick={submit} disabled={typed.replace(/\s+/g, '').length < 3}>
          Use this number
        </Button>
      </form>
    </Sheet>
  )
}
