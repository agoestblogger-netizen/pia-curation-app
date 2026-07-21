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
  signatureContainer: { marginTop: 40, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  signatureBox: { width: '30%', alignItems: 'center', marginBottom: 40, paddingHorizontal: 10 },
  sigName: { marginTop: 50, fontWeight: 'bold', textDecoration: 'underline', textAlign: 'center' },
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
}: GFBeritaAcaraProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>BERITA ACARA PENETAPAN HASIL GRAND FINAL</Text>
        <Text style={styles.subtitle}>{competitionName}</Text>
      </View>

      <Text style={styles.paragraph}>
        Pada hari ini, tanggal {dateStr}, telah dilaksanakan penilaian akhir (Grand Final) untuk kompetisi inovasi {competitionName} oleh Tim Sponsor (Board of Directors). Berdasarkan hasil penilaian keempat parameter (Problem & Solution Fit, Impact, Kelayakan & Skalabilitas, serta Professional Judgement), berikut adalah urutan klasifikasi akhir proposal inovasi:
      </Text>

      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.colNo]}>No</Text>
          <Text style={[styles.cell, styles.colTitle]}>Judul Proposal</Text>
          <Text style={[styles.cell, styles.colCat]}>Kategori</Text>
          <Text style={[styles.cell, styles.colScore]}>Rata-rata Skor</Text>
          <Text style={[styles.cell, styles.colClass]}>Klasifikasi Akhir</Text>
        </View>
        
        {proposals.map((p, idx) => (
          <View key={p.id} style={styles.row}>
            <Text style={[styles.cell, styles.colNo]}>{idx + 1}</Text>
            <Text style={[styles.cell, styles.colTitle]}>{p.title}</Text>
            <Text style={[styles.cell, styles.colCat]}>{p.category}</Text>
            <Text style={[styles.cell, styles.colScore]}>{p.totalScore}</Text>
            <Text style={[styles.cell, styles.colClass]}>{p.classification}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.paragraph}>
        Demikian berita acara ini dibuat untuk digunakan sebagaimana mestinya. Penetapan ini bersifat mutlak dan tidak dapat diganggu gugat.
      </Text>

      <View style={{ marginTop: 20 }}>
        <Text style={{ marginBottom: 10 }}>Ditetapkan oleh Tim Sponsor:</Text>
        <View style={styles.signatureContainer}>
          {sponsors.map(sponsor => (
            <View key={sponsor.id} style={styles.signatureBox}>
              <Text>Ttd.</Text>
              <Text style={styles.sigName}>{sponsor.name}</Text>
              <Text style={styles.sigRole}>Sponsor / Direksi</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  </Document>
);
