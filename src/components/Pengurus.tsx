
import { toImageKitUrl } from '../utils/imageUtils'

interface PengurusRecord {
  id: string
  jabatan: string
  nama: string
  photo: string
}

interface Props {
  data: PengurusRecord[]
}

export default function Pengurus({ data }: Props) {
  return (
    <div className="page-card">
      <h2>Struktur Pengurus IMKKSA</h2>

      <div className="pengurus-grid">
        {data.map((p) => (
          <div className="pengurus-card" key={p.id}>
            <img
              src={toImageKitUrl(p.photo || '/LOGO_KARO.jpg', 400)}
              alt={p.nama}
              className="pengurus-photo"
            />

            <h3>{p.jabatan}</h3>

            <p>{p.nama}</p>
          </div>
        ))}
      </div>
    </div>
  )
}