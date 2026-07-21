import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts if needed, assuming the project uses standard fonts or we just stick to defaults.
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#000', lineHeight: 1.4 },
  header: { marginBottom: 20, alignItems: 'center', textAlign: 'center' },
  headerTextBold: { fontSize: 11, fontWeight: 'bold', fontFamily: 'Helvetica-Bold' },
  headerTitle: { fontSize: 11, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginTop: 10 },
  paragraph: { textAlign: 'justify', marginBottom: 10 },
  listContainer: { marginBottom: 10 },
  listItem: { flexDirection: 'row', marginBottom: 3 },
  listBullet: { width: 15, textAlign: 'center' },
  listText: { flex: 1, textAlign: 'justify' },
  sectionTitle: { fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 5, textAlign: 'center' },
  
  // Table Summary
  tableSummary: { width: '80%', marginBottom: 10 },
  rowSummary: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingVertical: 4 },
  colSummaryUraian: { width: '70%' },
  colSummaryJumlah: { width: '30%' },
  
  // Signatures
  signatureSection: { marginTop: 30 },
  signatureTitle: { fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 5 },
  tableSig: { width: '100%', marginBottom: 30 },
  rowSigHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#000', paddingBottom: 5, marginBottom: 15 },
  rowSig: { flexDirection: 'row', marginBottom: 30 },
  colSigNo: { width: '10%' },
  colSigNama: { width: '30%' },
  colSigJabatan: { width: '30%' },
  colSigTtd: { width: '30%' },
  textBold: { fontWeight: 'bold', fontFamily: 'Helvetica-Bold' },

  mengetahui: { marginTop: 20, alignItems: 'flex-end' },
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
  stats?: {
    total: number;
    admin: number;
    lolos: number;
    promotor: number;
  };
  dateInfo?: {
    dayName: string;
    dateNum: string;
    monthName: string;
    yearStr: string;
    place: string;
  };
  ketuaName?: string | null;
  sekretarisName?: string | null;
  regionName?: string;
  generatedAt?: string;
  generatedBy?: string;
  curatorName?: string;
  fgdType?: string;
}

export const FgdBeritaAcaraReport = ({
  competitionName,
  proposals,
  participants,
  stats,
  dateInfo,
  ketuaName,
  sekretarisName,
  regionName,
  generatedAt,
  generatedBy,
  curatorName,
  fgdType
}: FgdBeritaAcaraProps) => {
  const isPromoter = fgdType === 'promoter';
  const tahapName = isPromoter ? 'Kurasi Tingkat Promotor' : 'Kurasi Internal';
  const prevTahapName = isPromoter ? 'Kurasi Tingkat Kurator' : 'Kurasi Internal';
  const nextTahapName = isPromoter ? 'Grand Final' : 'Kurasi Tingkat Promotor';
  const timName = isPromoter ? 'Tim Promotor' : 'Tim Task Force Kurator';

  return (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerTextBold}>PT PEGADAIAN</Text>
        <Text style={styles.headerTextBold}>BERITA ACARA</Text>
        <Text style={styles.headerTextBold}>PENETAPAN HASIL {isPromoter ? 'KURASI TINGKAT PROMOTOR' : 'KURASI INTERNAL'}</Text>
        {!isPromoter && <Text style={styles.headerTextBold}>{timName.toUpperCase()}</Text>}
        <Text style={styles.headerTitle}>PEGADAIAN INNOVATION AWARD (PIA) S12 TAHUN 2026</Text>
        <Text style={{ marginTop: 10 }}>Nomor: BA-____/IC/PIA/X/2026</Text>
      </View>

      <Text style={styles.paragraph}>
        Pada hari ini {dateInfo?.dayName}, tanggal {dateInfo?.dateNum} bulan {dateInfo?.monthName} tahun {dateInfo?.yearStr}, bertempat di Jakarta, {timName} Pegadaian Innovation Award (PIA) S12 Tahun 2026 telah melaksanakan Rapat Penetapan Hasil {tahapName} terhadap proposal inovasi yang telah diterima dari seluruh Unit Kerja di lingkungan PT Pegadaian.
      </Text>

      <Text style={styles.paragraph}>
        {tahapName} dilaksanakan sebagai tahapan seleksi untuk memastikan bahwa proposal inovasi yang diajukan telah memenuhi persyaratan administrasi, substansi, kualitas inovasi, serta kesesuaian dengan pedoman Pegadaian Innovation Award (PIA) S12 Tahun 2026 sebelum diajukan ke Tahap {nextTahapName}.
      </Text>

      <Text style={styles.paragraph}>
        Berdasarkan hasil pembahasan, penilaian, klarifikasi, dan musyawarah {timName}, dengan ini diputuskan sebagai berikut:
      </Text>

      <Text style={styles.sectionTitle}>KESATU</Text>
      <Text style={styles.paragraph}>
        Menetapkan hasil {tahapName} terhadap seluruh proposal inovasi yang masuk pada Pegadaian Innovation Award (PIA) S12 Tahun 2026 sebagaimana tercantum dalam Lampiran Berita Acara ini.
      </Text>

      <Text style={styles.sectionTitle}>KEDUA</Text>
      <Text style={styles.paragraph}>
        Proposal yang dinyatakan Lolos {tahapName} merupakan proposal yang telah memenuhi persyaratan administrasi dan memperoleh hasil penilaian sesuai kriteria kurasi yang ditetapkan dalam Pedoman Pegadaian Innovation Award (PIA) S12 Tahun 2026.
      </Text>

      <Text style={styles.sectionTitle}>KETIGA</Text>
      <Text style={styles.paragraph}>
        Proposal yang dinyatakan Lolos {tahapName} direkomendasikan untuk mengikuti Tahap {nextTahapName} sesuai mekanisme dan jadwal pelaksanaan Pegadaian Innovation Award (PIA) S12 Tahun 2026.
      </Text>

      <Text style={styles.sectionTitle}>KEEMPAT</Text>
      <Text style={styles.paragraph}>
        {timName} berhak memberikan catatan, rekomendasi penyempurnaan, maupun perbaikan terhadap proposal sebelum dilakukan proses {nextTahapName}.
      </Text>

      <Text style={styles.sectionTitle}>KELIMA</Text>
      <Text style={styles.paragraph}>
        Hasil penetapan ini merupakan hasil musyawarah {timName} berdasarkan prinsip:
      </Text>
      <View style={styles.listContainer}>
        {['Objektif;', 'Transparan;', 'Akuntabel;', 'Independen;', 'Profesional; dan', `Berpedoman pada ketentuan Pegadaian Innovation Award (PIA) S12 Tahun 2026.`].map((item, idx) => (
          <View key={idx} style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>KEENAM</Text>
      <Text style={styles.paragraph}>
        Ringkasan hasil {tahapName} adalah sebagai berikut:
      </Text>
      <View style={styles.tableSummary}>
        <View style={styles.rowSummary}>
          <View style={styles.colSummaryUraian}><Text style={styles.textBold}>Uraian</Text></View>
          <View style={styles.colSummaryJumlah}><Text style={styles.textBold}>Jumlah</Text></View>
        </View>
        <View style={styles.rowSummary}>
          <View style={styles.colSummaryUraian}><Text>Proposal Memenuhi Persyaratan Administrasi</Text></View>
          <View style={styles.colSummaryJumlah}><Text>{stats?.admin ?? '....'} Proposal</Text></View>
        </View>
        <View style={styles.rowSummary}>
          <View style={styles.colSummaryUraian}><Text>Proposal Lolos {prevTahapName}</Text></View>
          <View style={styles.colSummaryJumlah}><Text>{stats?.lolos ?? '....'} Proposal</Text></View>
        </View>
        <View style={styles.rowSummary}>
          <View style={styles.colSummaryUraian}><Text>Proposal yang Lolos ke {nextTahapName}</Text></View>
          <View style={styles.colSummaryJumlah}><Text>{stats?.promotor ?? '....'} Proposal</Text></View>
        </View>
      </View>

      <Text style={styles.paragraph}>
        Daftar lengkap proposal sebagaimana dimaksud menjadi bagian yang tidak terpisahkan dari Berita Acara ini (Lampiran I).
      </Text>
      <Text style={styles.paragraph}>
        Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya sebagai dasar pengajuan proposal inovasi ke Tahap {nextTahapName} Pegadaian Innovation Award (PIA) S12 Tahun 2026.
      </Text>

      <View style={{ marginTop: 20, alignItems: 'flex-end' }}>
        <Text>Ditetapkan di : Jakarta</Text>
        <Text>Pada tanggal : {dateInfo?.dateNum} {dateInfo?.monthName} {dateInfo?.yearStr}</Text>
      </View>

      <View style={{ marginTop: 20, alignItems: 'center' }}>
        {!isPromoter && <Text style={styles.headerTextBold}>{timName.toUpperCase()}</Text>}
        <Text style={styles.headerTextBold}>PEGADAIAN INNOVATION AWARD (PIA) S12 TAHUN 2026</Text>
      </View>

      <View style={styles.signatureSection}>
        <View style={styles.rowSigHeader}>
          <Text style={[styles.colSigNo, styles.textBold]}>No</Text>
          <Text style={[styles.colSigNama, styles.textBold]}>Nama</Text>
          <Text style={[styles.colSigJabatan, styles.textBold]}>Jabatan</Text>
          <Text style={[styles.colSigTtd, styles.textBold]}>Tanda Tangan</Text>
        </View>
        
        {participants && participants.map((p, i) => (
          <View style={styles.rowSig} key={i}>
            <Text style={styles.colSigNo}>{i + 1}</Text>
            <Text style={styles.colSigNama}>{p.name}</Text>
            <Text style={styles.colSigJabatan}>{p.role}</Text>
            <Text style={styles.colSigTtd}></Text>
          </View>
        ))}
      </View>

      <View style={styles.mengetahui}>
        <View style={{ width: 180, alignItems: 'center' }}>
          <Text style={{ textAlign: 'center' }}>Mengetahui,</Text>
          <Text style={[styles.mengetahuiTitle, { textAlign: 'center' }]}>Kepala Divisi Innovation Center</Text>
          <View style={{ width: 180, borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', marginTop: 50, marginBottom: 5 }} />
          <Text style={{ width: 180, textAlign: 'center', fontSize: 9 }}>NIK ..................................</Text>
        </View>
      </View>
    </Page>

    {/* LAMPIRAN */}
    <Page size="A4" style={styles.page} orientation="landscape">
      <View style={[styles.lampiranHeader, { alignItems: 'center', textAlign: 'center' }]}>
        <Text style={styles.headerTextBold}>Lampiran I</Text>
        <Text style={[styles.headerTextBold, { marginTop: 10 }]}>DAFTAR PROPOSAL LOLOS KE {nextTahapName.toUpperCase()}</Text>
        <Text style={styles.headerTextBold}>PEGADAIAN INNOVATION AWARD (PIA) S12 TAHUN 2026</Text>
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
};
