import React from 'react'

interface PengurusRecord {
  id: string
  jabatan: string
  nama: string
  photo: string
}

interface Props {
  pengurusForm: any
  setPengurusForm: any
  handlePengurusPhoto: any
  handleSavePengurus: any
  data: PengurusRecord[]
}

export default function PengurusAdmin({
  pengurusForm,
  setPengurusForm,
  handlePengurusPhoto,
  handleSavePengurus,
  data
}: Props) {

  const jabatanList = [
    'Ketua',
    'Wakil Ketua',
    'Sekretaris',
    'Wakil Sekretaris',
    'Bendahara',
    'Wakil Bendahara'
  ]

  return (
    <div className="page-card">

      <h2>Manajemen Pengurus</h2>

      <div className="admin-data-form">

        <div className="form-group">

          <label>Upload Foto</label>

          <input
            type="file"
            accept="image/*"
            onChange={handlePengurusPhoto}
          />

        </div>

        <div className="form-group">

          <label>Jabatan</label>

          <select
            value={pengurusForm.jabatan}
            onChange={(e) =>
              setPengurusForm({
                ...pengurusForm,
                jabatan: e.target.value
              })
            }
          >
            {jabatanList.map(j => (
              <option key={j}>{j}</option>
            ))}
          </select>

        </div>

        <div className="form-group">

          <label>Nama</label>

          <input
            type="text"
            value={pengurusForm.nama}
            onChange={(e) =>
              setPengurusForm({
                ...pengurusForm,
                nama: e.target.value
              })
            }
          />

        </div>

        <button
          className="btn-save"
          onClick={handleSavePengurus}
        >
          SIMPAN PENGURUS
        </button>

      </div>

      <hr style={{ margin: '30px 0' }} />

      <div className="pengurus-grid">

        {data.map((p) => (

          <div
            className="pengurus-card"
            key={p.id}
          >

            <img
              src={p.photo}
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