# FITUR: FINAL REGIONAL — PIA Season 12

Spec ini mendefinisikan alur, data model, dan halaman untuk tahap **Final Regional** — kompetisi tambahan yang berjalan di 13 grup Regional (12 Kanwil + Pusat) secara **penuh terpisah** dari jalur Nasional (BI/BC → FGD Kurator → FGD Promotor → Grand Final Sponsor).

Prinsip utama: Final Regional TIDAK mengubah alur Nasional maupun alur Regional yang sudah ada (screening → 10 finalis terkunci per grup). Fitur ini adalah **kelanjutan** dari titik lock 10 finalis tersebut, dengan lifecycle miliknya sendiri per grup.

---

## 1. Ruang Lingkup & Prinsip Desain

- **13 grup independen.** Setiap Kanwil/Pusat punya lifecycle Final Regional sendiri-sendiri. Kanwil A bisa sudah selesai final sementara Kanwil B belum mulai — tidak ada tombol global yang memaksa serentak.
- **Reuse komponen, bukan reuse fase.** UI form penilaian, pola rekap, pola Sidang Penetapan, dan pola PDF meniru yang sudah terbukti jalan di Grand Final Sponsor — tapi state/fase-nya terpisah total (jangan campur ke `grand_final_assessments` tanpa diskriminator, gunakan tabel/kolom baru).
- **Basis data finalis:** 10 finalis per grup yang sudah dikunci di jalur Regional existing (`Surat Penetapan` atau `Berita Acara FGD Regional`). Final Regional tidak membuka tahap seleksi baru — pool sudah otomatis tersedia dari situ.

---

## 2. Role Baru

### Juri Regional
- Role baru, ditambahkan ke enum role yang sudah ada (multi-role array, sama pola dengan role lain).
- **3 Juri per Kanwil** (jumlah dinamis — ambil dari setting/konfigurasi kompetisi, bukan hardcode).
- Assignment Juri Regional ke grup dilakukan oleh **Koordinator pusat** (bukan PIC Regional) — pola mirip halaman Assign Proposal yang sudah ada, tapi assign *orang* ke *grup*, bukan proposal ke kurator.
- Juri Regional melihat **identitas lengkap** proposal (nama inovator, unit kerja, dll — TIDAK blind), karena saat presentasi finalis juga memperkenalkan diri langsung.

### PIC Regional
- Bukan role baru — ini adalah kurator yang sudah memegang grup itu (sesuai aturan "1 Regional = 1 Kurator Penuh" yang sudah ada).
- Wewenang tambahan di Final Regional: **membuka Sidang Penetapan** untuk grupnya, dan **mengunci hasil akhir** (ranking Juara 1/2/3).

---

## 3. Rubrik Penilaian

Rubrik **sama persis / salinan resmi** dari rubrik Grand Final — 4 parameter:

1. Problem & Solution Fit
2. Dampak terhadap Produktivitas
3. Kelayakan & Skalabilitas
4. Professional Judgement (Must/Should/Could/Won't Have)

Perbedaan dari rubrik Sponsor Nasional: setiap parameter dinilai dengan Level 1-4, tapi levelnya langsung berisi **band skor 0-100** (bukan skala 1-4):

| Level | Rentang Skor | Nilai Wakil (default) |
|-------|-------------|------------------------|
| Level 4 | 90-100 | 95 |
| Level 3 | 80-89 | 85 |
| Level 2 | 60-79 | 70 |
| Level 1 | <59 | 50 |

**Mekanisme input UI (per parameter):**
1. Juri klik salah satu dari 4 kartu Level (masing-masing menampilkan deskripsi kualitatif Level itu, disalin apa adanya dari dokumen rubrik resmi).
2. Begitu diklik, kartu ter-highlight dan sebuah kotak angka muncul, **otomatis terisi nilai wakil** dari Level tersebut.
3. Angka itu **bisa diedit bebas oleh Juri**, tapi di-*clamp* ke rentang Level yang dipilih (contoh: pilih Level 3 → hanya bisa isi 80-89; input di luar itu ditolak/snap ke batas terdekat).
4. Kalau Juri puas dengan nilai wakil, tidak perlu mengedit apa-apa — 1 klik per parameter sudah cukup.

**Formula skor:**
- Skor per proposal (per Juri) = rata-rata dari 4 skor parameter (hasil: 0-100).
- Skor final proposal = rata-rata skor dari SEMUA Juri yang menilai grup itu (jumlah juri dinamis dari setting).
- Ranking = urutkan skor final descending per grup → 3 skor tertinggi = **Juara 1, 2, 3**. 7 finalis sisanya tetap berstatus "Finalis" tanpa gelar juara.

**Tie-break:** Jika skor final identik di batas Juara 2/3, tidak ada aturan matematis otomatis — diselesaikan secara manusiawi lewat Sidang Penetapan (juri bisa lihat & koreksi skor sendiri). Sebagai fallback kalau Sidang tidak dibuka dan seri tetap terjadi: PIC Regional diberi opsi override manual (pilih pemenang) di layar Kunci Hasil, khusus untuk kasus seri — harus dicatat di Audit Log dengan alasan.

---

## 4. Lifecycle per Grup (State Machine)

Setiap grup (13 total) punya fase sendiri, independen dari grup lain dan dari fase Nasional:

```
finalis_terkunci (dari jalur Regional existing)
        │
        ▼
juri_ditugaskan       ← Koordinator assign 3 Juri ke grup ini
        │
        ▼
penilaian_dibuka      ← Juri mulai isi skor (bisa paralel, tidak perlu urut)
        │
        ▼
penilaian_selesai     ← semua Juri submit skor untuk semua 10 finalis
        │
        ▼
(opsional) sidang_penetapan   ← DIBUKA oleh PIC Regional, setting visibilitas
        │                        skor antar-Juri sama pola dgn Sidang Nasional
        ▼
hasil_terkunci        ← PIC Regional kunci → ranking final, tidak bisa diubah
        │
        ▼
PDF "Surat Penetapan Juara Regional" tersedia
```

Catatan: fase ini disimpan per-grup (kolom `status` di tabel sesi/grup Final Regional), bukan satu status global.

---

## 5. Data Model (usulan)

Tabel baru (nama indikatif, sesuaikan konvensi Drizzle yang sudah ada):

- **`regional_final_sessions`** — 1 row per grup (13 total): `region` (kota/`Pusat`), `status` (state machine di atas), `juri_count_setting`, `locked_by`, `locked_at`.
- **`regional_final_judges`** — assignment Juri Regional ke grup: `session_id`, `user_id`, `assigned_by`, `assigned_at`.
- **`regional_final_assessments`** — skor per Juri per proposal per parameter: `session_id`, `proposal_id`, `judge_user_id`, `param_problem_fit`, `param_dampak`, `param_kelayakan`, `param_professional`, `submitted_at`.
  - Gunakan kolom terpisah per parameter (bukan JSON) supaya rekap & audit lebih gampang, konsisten dengan pola `grand_final_assessments` yang sudah ada.
- **`regional_final_results`** — hasil terkunci per grup: `session_id`, `proposal_id`, `final_score`, `rank` (1/2/3/null), `locked_by`, `locked_at`, `tie_break_note` (nullable, diisi kalau override manual dipakai).

**PENTING:** jangan pakai tabel `grand_final_assessments` untuk data ini — tabel terpisah supaya reset data, audit log, dan guard akses tidak tercampur antara Regional dan Nasional.

---

## 6. Halaman & Menu

- **Menu sidebar baru, terpisah** (bukan tab di "Finalisasi & Ranking"): misal "Final Regional".
- Isi menu:
  - **Koordinator/Admin**: lihat semua 13 grup, assign Juri per grup, lihat status tiap grup.
  - **PIC Regional**: hanya grup miliknya — tombol buka Sidang Penetapan, tombol Kunci Hasil, lihat rekap skor.
  - **Juri Regional**: hanya grup yang dia ditugaskan — form penilaian per proposal (list 10 finalis → expand ke form skor 4 parameter, identitas lengkap tampil).
- **Privilege diatur di Manajemen User** — tambahkan opsi role "Juri Regional" ke multi-role array yang sudah ada. Guard akses di server action: scope by `region` yang di-assign, bukan akses bebas semua grup (kecuali Admin/Koordinator).
- Halaman form penilaian Juri: ikuti pola full-width tanpa sidebar seperti halaman Papan Penilaian Sponsor, dengan link "Kembali".

---

## 7. PDF Output

**"Surat Penetapan Juara Regional"** — 1 dokumen per grup, dibuat saat PIC Regional mengunci hasil. Mengikuti pola Berita Acara/PDF Grand Final:
- Isi: nama grup (Kanwil/Pusat), daftar 10 finalis dengan skor final, Juara 1/2/3 ditandai jelas.
- Kolom tanda tangan terpisah: PIC Regional + 3 Juri Regional.
- Sekali di-generate, dokumen final (tidak berubah lagi kecuali reset data).

---

## 8. Reset Data

Tambahkan checkbox baru di menu Reset Data (Admin) untuk Final Regional: assignment Juri, skor penilaian, hasil terkunci — terpisah dari checkbox Reset Regional (10 finalis) dan Reset Grand Final yang sudah ada, supaya admin bisa reset salah satu tanpa mengganggu yang lain.

---

## 9. Item yang Masih Perlu Diverifikasi Saat Implementasi

- Deskripsi kualitatif Level 1-4 per parameter di rubrik resmi harus disalin verbatim ke seed data/komponen UI (sumber: dokumen rubrik yang sudah dibagikan).
- Perilaku *clamp* input angka: pastikan validasi jalan di client DAN server (jangan cuma di UI).
- Audit log: setiap submit skor, buka Sidang, kunci hasil, dan override tie-break harus tercatat.
