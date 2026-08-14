// src/utils/pdfUtils.ts
// Generate PDF proposal: isi form field di COVER.pdf (nomor, tanggal, tujuan),
// gabung dengan halaman ISI.pdf, flatten, lalu kembalikan bytes siap unduh.
import { PDFDocument, PDFForm, PDFTextField } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

export interface ProposalPdfData {
  nomorSurat: string
  tanggalSurat: string
  tujuanSurat: string
}

interface CoverFields {
  nomor: PDFTextField
  tanggal: PDFTextField
  tujuan: PDFTextField
}

/**
 * Cari field cover secara otomatis:
 * - utamakan nama field yang dikenal (nomor_surat, tanggal_surat, tujuan_surat)
 * - kalau template di-export ulang dan nama field berubah (mis. Text1/Text2/Text3),
 *   petakan ulang berdasarkan karakteristik & posisi:
 *   tujuan = field multiline (kotak besar 2 baris),
 *   nomor  = field paling kiri,
 *   tanggal = field paling kanan.
 */
function resolveCoverFields(coverForm: PDFForm): CoverFields {
  const textFields = coverForm.getFields().filter((f) => f instanceof PDFTextField) as PDFTextField[]
  const byName = (name: string) => textFields.find((f) => f.getName() === name)

  const tujuan = byName('tujuan_surat') ?? textFields.find((f) => f.isMultiline())
  const sisa = textFields.filter((f) => f !== tujuan)
  const xOf = (f: PDFTextField) => f.acroField.getWidgets()[0]?.getRectangle().x ?? 0
  const [kiri, kanan] = [...sisa].sort((a, b) => xOf(a) - xOf(b))

  const nomor = byName('nomor_surat') ?? kiri
  const tanggal = byName('tanggal_surat') ?? kanan

  if (!nomor || !tanggal || !tujuan) {
    throw new Error(
      '[Proposal PDF] Field cover tidak lengkap. Terdeteksi: ' +
        textFields.map((f) => f.getName()).join(', '),
    )
  }
  return { nomor, tanggal, tujuan }
}

/**
 * Generate file PDF proposal (1 file utuh: cover + isi).
 * Field di cover COVER.pdf diisi otomatis (nomor, tanggal, tujuan), lalu di-flatten.
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
    const { nomor, tanggal, tujuan } = resolveCoverFields(coverForm)
    nomor.setText(data.nomorSurat)
    tanggal.setText(data.tanggalSurat)

    // Penerima boleh 2 baris → aktifkan mode multiline agar baris kedua tampil
    tujuan.enableMultiline()
    tujuan.setText(data.tujuanSurat)
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
