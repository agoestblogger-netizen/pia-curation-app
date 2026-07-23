import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.5 },
  header: { textAlign: 'center', marginBottom: 20 },
  title: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  subtitle: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  paragraph: { textAlign: 'justify', marginBottom: 15 },
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#000', marginBottom: 20 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000' },
  headerRow: { backgroundColor: '#f0f0f0', fontWeight: 'bold' },
  cell: { padding: 5, borderRightWidth: 1, borderRightColor: '#000', fontSize: 9 },
  colNo: { width: '5%', textAlign: 'center' },
  colTitle: { width: '45%' },
  colCat: { width: '15%', textAlign: 'center' },
  colScore: { width: '15%', textAlign: 'center' },
  colClass: { width: '20%', textAlign: 'center', borderRightWidth: 0 },
  signatureSection: { marginTop: 20 },
  establishedRight: { alignItems: 'flex-end', marginBottom: 15 },
  groupTitleCentered: { fontWeight: 'bold', textAlign: 'center', marginBottom: 15, fontSize: 11 },
  signatureContainer: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' },
  signatureBox: { width: '30%', alignItems: 'center', marginBottom: 25, paddingHorizontal: 10 },
  sigName: { marginTop: 45, fontWeight: 'bold', textDecoration: 'underline', textAlign: 'center' },
  sigRole: { textAlign: 'center' },
});

type ProposalRow = {
  id: number;
  title: string;
  category: string;
  totalScore: string;
  classification: string;
};

type GFBeritaAcaraProps = {
  competitionName: string;
  dateStr: string;
  proposals: ProposalRow[];
  sponsors: { id: number; name: string }[];
  generatedBy?: string;
};

export const GrandFinalBeritaAcara = ({
  competitionName,
  dateStr,
  proposals,
  sponsors,
}: GFBeritaAcaraProps) => {
  const fullCompName = competitionName
    ? (competitionName.includes('Season 12') ? competitionName : `${competitionName} Season 12 Tahun 2026`)
    : 'PEGADAIAN INNOVATION AWARD Season 12 Tahun 2026';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>BERITA ACARA PENETAPAN HASIL GRAND FINAL</Text>
          <Text style={styles.subtitle}>{fullCompName}</Text>
        </View>

        <Text style={styles.paragraph}>
          Pada hari ini, tanggal {dateStr}, telah dilaksanakan penilaian akhir (Grand Final) untuk kompetisi inovasi {fullCompName} oleh Tim Sponsor (Board of Directors). Berdasarkan hasil penilaian keempat parameter (Problem & Solution Fit, Impact, Kelayakan & Skalabilitas, serta Professional Judgement), berikut adalah hasil final urutan para pemenang:
        </Text>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]} wrap={false}>
            <Text style={[styles.cell, styles.colNo]}>No</Text>
            <Text style={[styles.cell, styles.colTitle]}>Judul Proposal</Text>
            <Text style={[styles.cell, styles.colCat]}>Kategori</Text>
            <Text style={[styles.cell, styles.colScore]}>Rata-rata Skor</Text>
            <Text style={[styles.cell, styles.colClass]}>Klasifikasi Akhir</Text>
          </View>
          
          {proposals.map((p, idx) => (
            <View key={p.id} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.colNo]}>{idx + 1}</Text>
              <Text style={[styles.cell, styles.colTitle]}>{p.title}</Text>
              <Text style={[styles.cell, styles.colCat]}>
                {p.category === 'BI' ? 'Breakthrough Innovation' : p.category === 'BC' ? 'Business Case' : p.category}
              </Text>
              <Text style={[styles.cell, styles.colScore]}>{p.totalScore}</Text>
              <Text style={[styles.cell, styles.colClass]}>{p.classification}</Text>
            </View>
          ))}
        </View>

        {/* Wrap closing paragraph, Ditetapkan di, group title, and signatures together so they don't break across pages */}
        <View wrap={false} style={{ marginTop: 15 }}>
          <Text style={styles.paragraph}>
            Demikian berita acara ini dibuat untuk digunakan sebagaimana mestinya. Penetapan ini bersifat mutlak dan tidak dapat diganggu gugat.
          </Text>

          <View style={styles.signatureSection}>
            <View style={styles.establishedRight}>
              <Text style={{ fontWeight: 'bold' }}>Ditetapkan di Jakarta, {dateStr}</Text>
            </View>

            <Text style={styles.groupTitleCentered}>
              Tim Sponsor & Dewan Juri Grand Final PIA Season 12 tahun 2026
            </Text>

            <View style={styles.signatureContainer}>
              {sponsors.map(sponsor => (
                <View key={sponsor.id} style={styles.signatureBox} wrap={false}>
                  <Text style={styles.sigName}>{sponsor.name}</Text>
                  <Text style={styles.sigRole}>Sponsor / Direksi</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};
