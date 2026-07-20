import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts if needed, assuming the project uses standard fonts or we just stick to defaults.
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#000', lineHeight: 1.4 },
  header: { marginBottom: 20 },
  headerTextBold: { fontSize: 11, fontWeight: 'bold', fontFamily: 'Helvetica-Bold' },
  headerTitle: { fontSize: 11, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginTop: 10 },
  paragraph: { textAlign: 'justify', marginBottom: 10 },
  listContainer: { marginBottom: 10 },
  listItem: { flexDirection: 'row', marginBottom: 3 },
  listBullet: { width: 15, textAlign: 'center' },
  listText: { flex: 1, textAlign: 'justify' },
  sectionTitle: { fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 5 },
  
  // Table Summary
  tableSummary: { width: '80%', marginBottom: 10 },
  rowSummary: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingVertical: 4 },
  colSummaryUraian: { width: '70%' },
  colSummaryJumlah: { width: '30%' },
  
  // Signatures
  signatureSection: { marginTop: 30 },
  signatureTitle: { fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 5 },
  tableSig: { width: '100%', marginBottom: 30 },
  rowSigHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 5, marginBottom: 10 },
  rowSig: { flexDirection: 'row', marginBottom: 30 },
  colSigNo: { width: '10%' },
  colSigNama: { width: '30%' },
  colSigJabatan: { width: '30%' },
  colSigTtd: { width: '30%' },
  textBold: { fontWeight: 'bold', fontFamily: 'Helvetica-Bold' },

  mengetahui: { marginTop: 20 },
  mengetahuiTitle: { marginBottom: 40 },
  
  // Lampiran
  lampiranHeader: { marginBottom: 20 },
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#000', marginBottom: 10 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000' },
  tableHeader: { backgroundColor: '#f0f0f0', fontWeight: 'bold', fontFamily: 'Helvetica-Bold' },
  tColNo: { width: '5%', padding: 4, borderRightWidth: 1, borderRightColor: '#000', textAlign: 'center' },
  tColKode: { width: '15%', padding: 4, borderRightWidth: 1, borderRightColor: '#000' },
  tColJudul: { width: '30%', padding: 4, borderRightWidth: 1, borderRightColor: '#000' },
  tColUnit: { width: '20%', padding: 4, borderRightWidth: 1, borderRightColor: '#000' },
  tColKetua: { width: '15%', padding: 4, borderRightWidth: 1, borderRightColor: '#000' },
  tColKategori: { width: '10%', padding: 4, borderRightWidth: 1, borderRightColor: '#000' },
  tColStatus: { width: '5%', padding: 4, textAlign: 'center' },
  tableCell: { fontSize: 8 },
  footer: { marginTop: 10, fontSize: 10, fontWeight: 'bold', fontFamily: 'Helvetica-Bold' }
});

interface FgdBeritaAcaraProps {
  competitionName: string;
  sessionName: string;
  scopeText: string;
  generatedAt: string;
  generatedBy: string;
  proposals: Array<{
    id: number;
    subId: string;
    title: string;
    proposerUnitKerja: string;
    proposerName: string;
    category: string;
  }>;
  participants: Array<{
    name: string;
    role: string;
  }>;
}

export const FgdBeritaAcaraReport = ({
  competitionName,
  proposals,
  participants
}: FgdBeritaAcaraProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerTextBold}>PT PEGADAIAN</Text>
        <Text style={styles.headerTextBold}>BERITA ACARA</Text>
        <Text style={styles.headerTextBold}>PENETAPAN HASIL KURASI INTERNAL</Text>
        <Text style={styles.headerTextBold}>TIM TASK FORCE KURATOR</Text>
        <Text style={styles.headerTitle}>{competitionName.toUpperCase()}</Text>
        <Text style={{ marginTop: 10 }}>Nomor: BA-____/IC/PIA/X/2026</Text>
      </View>

      <Text style={styles.paragraph}>
        Pada hari ini ____________, tanggal ____________ bulan ____________ tahun Dua Ribu Dua Puluh Enam, bertempat di ____________________, Tim Task Force Kurator {competitionName} telah melaksanakan Rapat Penetapan Hasil Kurasi Internal terhadap proposal inovasi yang telah diterima dari seluruh Unit Kerja di lingkungan PT Pegadaian.
      </Text>

      <Text style={styles.paragraph}>
        Kurasi Internal dilaksanakan sebagai tahapan seleksi untuk memastikan bahwa proposal inovasi yang diajukan telah memenuhi persyaratan administrasi, substansi, kualitas inovasi, serta kesesuaian dengan pedoman {competitionName} sebelum diajukan ke Tahap Kurasi Tingkat Promotor.
      </Text>

      <Text style={styles.paragraph}>
        Berdasarkan hasil pembahasan, penilaian, klarifikasi, dan musyawarah Tim Task Force Kurator, dengan ini diputuskan sebagai berikut:
      </Text>

      <Text style={styles.sectionTitle}>KESATU</Text>
      <Text style={styles.paragraph}>
        Menetapkan hasil Kurasi Internal terhadap seluruh proposal inovasi yang masuk pada {competitionName} sebagaimana tercantum dalam Lampiran Berita Acara ini.
      </Text>

      <Text style={styles.sectionTitle}>KEDUA</Text>
      <Text style={styles.paragraph}>
        Proposal yang dinyatakan Lolos Kurasi Internal merupakan proposal yang telah memenuhi persyaratan administrasi dan memperoleh hasil penilaian sesuai kriteria kurasi yang ditetapkan dalam Pedoman {competitionName}.
      </Text>

      <Text style={styles.sectionTitle}>KETIGA</Text>
      <Text style={styles.paragraph}>
        Proposal yang dinyatakan Lolos Kurasi Internal direkomendasikan untuk mengikuti Tahap Kurasi Tingkat Promotor sesuai mekanisme dan jadwal pelaksanaan {competitionName}.
      </Text>

      <Text style={styles.sectionTitle}>KEEMPAT</Text>
      <Text style={styles.paragraph}>
        Tim Task Force Kurator berhak memberikan catatan, rekomendasi penyempurnaan, maupun perbaikan terhadap proposal sebelum dilakukan proses Kurasi Tingkat Promotor.
      </Text>

      <Text style={styles.sectionTitle}>KELIMA</Text>
      <Text style={styles.paragraph}>
        Hasil penetapan ini merupakan hasil musyawarah Tim Task Force Kurator berdasarkan prinsip:
      </Text>
      <View style={styles.listContainer}>
        {['Objektif;', 'Transparan;', 'Akuntabel;', 'Independen;', 'Profesional; dan', `Berpedoman pada ketentuan ${competitionName}.`].map((item, idx) => (
          <View key={idx} style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>KEENAM</Text>
      <Text style={styles.paragraph}>
        Ringkasan hasil Kurasi Internal adalah sebagai berikut:
      </Text>
      <View style={styles.tableSummary}>
        <View style={styles.rowSummary}>
          <View style={styles.colSummaryUraian}><Text style={styles.textBold}>Uraian</Text></View>
          <View style={styles.colSummaryJumlah}><Text style={styles.textBold}>Jumlah</Text></View>
        </View>
        <View style={styles.rowSummary}>
          <View style={styles.colSummaryUraian}><Text>Total Proposal yang Diterima</Text></View>
          <View style={styles.colSummaryJumlah}><Text>.... Proposal</Text></View>
        </View>
        <View style={styles.rowSummary}>
          <View style={styles.colSummaryUraian}><Text>Proposal Memenuhi Persyaratan Administrasi</Text></View>
          <View style={styles.colSummaryJumlah}><Text>.... Proposal</Text></View>
        </View>
        <View style={styles.rowSummary}>
          <View style={styles.colSummaryUraian}><Text>Proposal Lolos Kurasi Internal</Text></View>
          <View style={styles.colSummaryJumlah}><Text>.... Proposal</Text></View>
        </View>
        <View style={styles.rowSummary}>
          <View style={styles.colSummaryUraian}><Text>Proposal Belum Lolos Kurasi Internal</Text></View>
          <View style={styles.colSummaryJumlah}><Text>.... Proposal</Text></View>
        </View>
      </View>

      <Text style={styles.paragraph}>
        Daftar lengkap proposal sebagaimana dimaksud menjadi bagian yang tidak terpisahkan dari Berita Acara ini (Lampiran I).
      </Text>
      <Text style={styles.paragraph}>
        Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya sebagai dasar pengajuan proposal inovasi ke Tahap Kurasi Tingkat Promotor {competitionName}.
      </Text>

      <View style={styles.signatureSection}>
        <Text>Ditetapkan di : _______________________</Text>
        <Text>Pada tanggal : _______________________</Text>
        <Text style={[styles.headerTextBold, { marginTop: 15 }]}>TIM TASK FORCE KURATOR</Text>
        <Text style={styles.headerTextBold}>{competitionName.toUpperCase()}</Text>

        <View style={[styles.tableSig, { marginTop: 15 }]}>
          <View style={styles.rowSigHeader}>
            <View style={styles.colSigNo}><Text style={styles.textBold}>No</Text></View>
            <View style={styles.colSigNama}><Text style={styles.textBold}>Nama</Text></View>
            <View style={styles.colSigJabatan}><Text style={styles.textBold}>Jabatan</Text></View>
            <View style={styles.colSigTtd}><Text style={styles.textBold}>Tanda Tangan</Text></View>
          </View>
          {[
            { nama: '....................', jabatan: 'Ketua Task Force Kurator' },
            { nama: '....................', jabatan: 'Sekretaris Task Force Kurator' },
            { nama: '....................', jabatan: 'Anggota Kurator' },
            { nama: '....................', jabatan: 'Anggota Kurator' },
            { nama: '....................', jabatan: 'Anggota Kurator' }
          ].map((sig, i) => (
            <View key={i} style={styles.rowSig}>
              <View style={styles.colSigNo}><Text>{i + 1}</Text></View>
              <View style={styles.colSigNama}><Text>{sig.nama}</Text></View>
              <View style={styles.colSigJabatan}><Text>{sig.jabatan}</Text></View>
              <View style={styles.colSigTtd}><Text></Text></View>
            </View>
          ))}
        </View>

        <View style={styles.mengetahui}>
          <Text>Mengetahui,</Text>
          <Text style={styles.mengetahuiTitle}>Head Division Innovation Center</Text>
          <Text>(...................................)</Text>
          <Text>NIK. ..........................</Text>
        </View>
      </View>
    </Page>

    {/* LAMPIRAN */}
    <Page size="A4" style={styles.page} orientation="landscape">
      <View style={styles.lampiranHeader}>
        <Text style={styles.headerTextBold}>Lampiran I</Text>
        <Text style={[styles.headerTextBold, { marginTop: 10 }]}>DAFTAR PROPOSAL LOLOS KURASI INTERNAL</Text>
        <Text style={styles.headerTextBold}>{competitionName}</Text>
      </View>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <View style={styles.tColNo}><Text style={styles.tableCell}>No</Text></View>
          <View style={styles.tColKode}><Text style={styles.tableCell}>Kode Proposal</Text></View>
          <View style={styles.tColJudul}><Text style={styles.tableCell}>Judul Proposal</Text></View>
          <View style={styles.tColUnit}><Text style={styles.tableCell}>Unit Kerja</Text></View>
          <View style={styles.tColKetua}><Text style={styles.tableCell}>Ketua Tim</Text></View>
          <View style={styles.tColKategori}><Text style={styles.tableCell}>Kategori</Text></View>
          <View style={styles.tColStatus}><Text style={styles.tableCell}>Status</Text></View>
        </View>
        
        {proposals.map((p, idx) => (
          <View style={styles.tableRow} key={p.id}>
            <View style={styles.tColNo}><Text style={styles.tableCell}>{idx + 1}</Text></View>
            <View style={styles.tColKode}><Text style={styles.tableCell}>{p.subId || '-'}</Text></View>
            <View style={styles.tColJudul}><Text style={styles.tableCell}>{p.title}</Text></View>
            <View style={styles.tColUnit}><Text style={styles.tableCell}>{p.proposerUnitKerja || '-'}</Text></View>
            <View style={styles.tColKetua}><Text style={styles.tableCell}>{p.proposerName || '-'}</Text></View>
            <View style={styles.tColKategori}><Text style={styles.tableCell}>{p.category}</Text></View>
            <View style={styles.tColStatus}><Text style={styles.tableCell}>Lolos</Text></View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        Jumlah Proposal Lolos : {proposals.length} proposal
      </Text>
    </Page>
  </Document>
);
