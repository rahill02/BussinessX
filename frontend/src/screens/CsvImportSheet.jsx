import { useState } from 'react'
import { api } from '../api.js'
import Sheet from '../components/Sheet.jsx'
import Button from '../components/Button.jsx'
import Banner from '../components/Banner.jsx'
import Icon from '../components/Icon.jsx'

export default function CsvImportSheet({ onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload() {
    if (!file) return setError('Choose a CSV file first.')
    setError(null)
    setUploading(true)
    try {
      const res = await api.importCsv(file)
      setResult(res)
      if (res.created.length > 0) onImported()
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Sheet title="Import from a spreadsheet" subtitle="Add many items at once" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <a
          href={api.csvTemplateUrl}
          download
          className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5 ring-1 ring-ink-200 transition hover:ring-ink-400"
        >
          <span>
            <span className="block text-[15px] font-medium text-ink-950">1. Download the template</span>
            <span className="block text-[13px] text-ink-400">Fill it in Excel or Google Sheets</span>
          </span>
          <Icon name="download" size={20} className="text-accent" />
        </a>

        <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-ink-200 bg-white px-4 py-7 text-center transition hover:border-accent">
          <Icon name="upload" size={24} className="text-accent" />
          <span className="text-[15px] font-medium text-ink-950">{file ? file.name : '2. Choose your CSV file'}</span>
          <span className="text-[12.5px] text-ink-400">Pieces and Weight items. Add Sizes items from the Add tab.</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files[0] || null)
              setResult(null)
              setError(null)
            }}
          />
        </label>

        {error && <Banner tone="error">{error}</Banner>}

        <Button onClick={handleUpload} disabled={uploading || !file}>
          {uploading ? 'Importing…' : 'Import items'}
        </Button>

        {result && (
          <div className="flex flex-col gap-2">
            <Banner tone={result.created.length ? 'success' : 'warn'}>
              {result.created.length} item{result.created.length === 1 ? '' : 's'} added
              {result.errors.length > 0 && `, ${result.errors.length} row${result.errors.length === 1 ? '' : 's'} need fixing`}
            </Banner>
            {result.errors.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-2xl bg-white ring-1 ring-ink-200">
                {result.errors.map((e, i) => (
                  <div key={e.row} className={`flex gap-3 px-4 py-2.5 text-[13px] ${i > 0 ? 'border-t border-ink-100' : ''}`}>
                    <span className="shrink-0 font-mono font-semibold text-rose-600">Row {e.row}</span>
                    <span className="text-ink-700">{e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
