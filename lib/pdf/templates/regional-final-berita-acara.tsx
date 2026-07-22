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
  proposerName: string;
  totalScore: string;
  rank: number | null;
  isTieBreak: boolean;
};

type RFBeritaAcaraProps = {
  competitionName: string;
  regionName: string;
  dateStr: string;
  proposals: ProposalRow[];
  judges: { id: number; name: string }[];
  picName: string;
  generatedBy?: string;
};

export const RegionalFinalBeritaAcara = ({
  competitionName,
  regionName,
  dateStr,
  proposals,
  judges,
  picName,
}: RFBeritaAcaraProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>BERITA ACARA PENETAPAN HASIL FINAL REGIONAL</Text>
        <Text style={styles.subtitle}>{regionName} - {competitionName}</Text>
      </View>

      <Text style={styles.paragraph}>
        Pada hari ini, tanggal {dateStr}, telah dilaksanakan Sidang Penetapan Final Regional untuk Grup {regionName} pada kompetisi {competitionName}. Berdasarkan hasil penilaian keempat parameter (Problem & Solution Fit, Impact, Kelayakan & Skalabilitas, serta Professional Judgement) oleh Dewan Juri Regional, berikut adalah urutan ranking akhir proposal:
      </Text>

      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.colNo]}>Rank</Text>
          <Text style={[styles.cell, styles.colTitle]}>Judul Proposal</Text>
          <Text style={[styles.cell, styles.colCat]}>Inovator</Text>
          <Text style={[styles.cell, styles.colScore]}>Rata-rata Skor</Text>
          <Text style={[styles.cell, styles.colClass]}>Kategori</Text>
        </View>
        
        {proposals.map((p, idx) => (
          <View key={p.id} style={styles.row}>
            <Text style={[styles.cell, styles.colNo]}>{p.rank ? `${p.rank}${p.isTieBreak ? '*' : ''}` : '-'}</Text>
            <Text style={[styles.cell, styles.colTitle]}>{p.title}</Text>
            <Text style={[styles.cell, styles.colCat]}>{p.proposerName}</Text>
            <Text style={[styles.cell, styles.colScore]}>{p.totalScore}</Text>
            <Text style={[styles.cell, styles.colClass]}>{p.category}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.paragraph}>
        Demikian berita acara ini dibuat untuk digunakan sebagaimana mestinya. Hasil pemeringkatan bersifat mutlak berdasarkan hasil penilaian yang telah disepakati oleh Dewan Juri Regional.
      </Text>

      <View style={{ marginTop: 20 }}>
        <Text style={{ marginBottom: 10 }}>Ditetapkan oleh Juri Regional dan PIC Regional:</Text>
        <View style={styles.signatureContainer}>
          <View style={styles.signatureBox}>
            <Text>Ttd.</Text>
            <Text style={styles.sigName}>{picName}</Text>
            <Text style={styles.sigRole}>PIC Regional</Text>
          </View>
          {judges.map(judge => (
            <View key={judge.id} style={styles.signatureBox}>
              <Text>Ttd.</Text>
              <Text style={styles.sigName}>{judge.name}</Text>
              <Text style={styles.sigRole}>Juri Regional</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  </Document>
);
