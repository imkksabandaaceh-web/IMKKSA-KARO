// src/utils/pdfUtils.ts
// Generate PDF proposal: isi form field di COVER.pdf (nomor, tanggal, tujuan),
// gabung dengan halaman ISI.pdf, flatten, lalu kembalikan bytes siap unduh.
import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

export interface ProposalPdfData {
  nomorSurat: string
  tanggalSurat: string
  tujuanSurat: string
}

/**
 * Generate file PDF proposal (1 file utuh: cover + isi).
 * Field di cover COVER.pdf: nomor_surat, tanggal_surat, tujuan_surat.
 * Saat generate, daftar field dicetak ke konsol (F12) untuk verifikasi nama field.
 */
export async function generateProposalPdf(data: ProposalPdfData): Promise<Uint8Array> {
  const [coverBytes, isiBytes] = await Promise.all([
    fetch('/COVER.pdf').then((r) => r.arrayBuffer()),
    fetch('/ISI.pdf').then((r) => r.arrayBuffer()),
  ])

  const cover = await PDFDocument.load(coverBytes, { ignoreEncryption: true })
  const isi = await PDFDocument.load(isiBytes, { ignoreEncryption: true })

  // Isi & flatten field DI DOKUMEN COVER ASLI dulu — copyPages tidak membawa
  // form field ke dokumen baru, jadi kita isi di sumbernya, lalu gabung halamannya.
  const coverForm = cover.getForm()
  const fieldNames = coverForm.getFields().map((f) => f.getName())
  console.log('[Proposal PDF] Field di cover:', fieldNames)

  try {
    coverForm.getTextField('nomor_surat').setText(data.nomorSurat)
    coverForm.getTextField('tanggal_surat').setText(data.tanggalSurat)

    // Penerima boleh 2 baris → aktifkan mode multiline agar baris kedua tampil
    const tujuanField = coverForm.getTextField('tujuan_surat')
    tujuanField.enableMultiline()
    tujuanField.setText(data.tujuanSurat)
  } catch (err) {
    console.error('[Proposal PDF] Gagal mengisi field:', err)
    throw err
  }

  // Flatten: teks field menjadi permanen (form tidak bisa diedit lagi)
  coverForm.flatten()

  const out = await PDFDocument.create()
  out.registerFontkit(fontkit)

  // Gabung: halaman cover (sudah terisi) dulu, lalu halaman isi
  const coverPages = await out.copyPages(cover, cover.getPageIndices())
  coverPages.forEach((p) => out.addPage(p))
  const isiPages = await out.copyPages(isi, isi.getPageIndices())
  isiPages.forEach((p) => out.addPage(p))

  return out.save()
}

/** Unduh Uint8Array sebagai file PDF di browser. */
export function downloadPdfBytes(bytes: Uint8Array, fileName: string): void {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
