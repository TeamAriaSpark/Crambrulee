// Client-side PDF text extraction with pdf.js. The worker is inlined into the
// bundle (?worker&inline) so it also works in single-file builds; notes never
// leave the browser.

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'

let workerStarted = false

export async function extractPdfText(file) {
  if (!workerStarted) {
    GlobalWorkerOptions.workerPort = new PdfWorker()
    workerStarted = true
  }

  const loadingTask = getDocument({ data: await file.arrayBuffer() })
  const pdf = await loadingTask.promise
  try {
    const pages = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      let text = ''
      for (const item of content.items) {
        if (!('str' in item)) continue
        text += item.str
        text += item.hasEOL ? '\n' : ' '
      }
      pages.push(text.trim())
    }
    const fullText = pages.filter(Boolean).join('\n\n')
    if (fullText.replace(/\s/g, '').length < 40) {
      throw new Error(
        `“${file.name}” looks like a scanned PDF with no selectable text — we can only cook with real text. Try exporting it with OCR, or paste the content instead.`
      )
    }
    return fullText
  } finally {
    loadingTask.destroy()
  }
}
