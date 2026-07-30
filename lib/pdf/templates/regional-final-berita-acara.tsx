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

const getCityFromRegion = (region: string) => {
  if (!region) return 'Jakarta';
  if (region === 'Kantor Pusat') return 'Jakarta';
  const clean = region.replace(/^Kanwil\s+(?:[IVXLCDM]+\s+|\d+\s+)*/i, '').trim();
  return clean || region;
};

type ProposalRow = {
  id: number;
  title: string;
  category: string;
  proposerName: string;
  proposerUnitKerja?: string | null;
  proposerNik?: string | null;
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
  picName?: string;
  generatedBy?: string;
};

export const RegionalFinalBeritaAcara = ({
  competitionName,
  regionName,
  dateStr,
  proposals,
  judges,
}: RFBeritaAcaraProps) => {
  const fullCompName = competitionName
    ? (competitionName.includes('Season 12') ? competitionName : `${competitionName} Season 12 Tahun 2026`)
    : 'PEGADAIAN INNOVATION AWARD Season 12 Tahun 2026';

  const cityName = getCityFromRegion(regionName);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>BERITA ACARA PENETAPAN HASIL FINAL REGIONAL</Text>
          <Text style={styles.subtitle}>{regionName} - {fullCompName}</Text>
        </View>

        <Text style={styles.paragraph}>
          Pada hari ini, tanggal {dateStr}, telah dilaksanakan Sidang Penetapan Final Regional untuk Grup {regionName} pada kompetisi {fullCompName}. Berdasarkan hasil penilaian keempat parameter (Problem & Solution Fit, Impact, Kelayakan & Skalabilitas, serta Professional Judgement) oleh Dewan Juri Regional, berikut adalah hasil final urutan para pemenang:
        </Text>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]} wrap={false}>
            <Text style={[styles.cell, styles.colNo]}>Rank</Text>
            <Text style={[styles.cell, styles.colTitle]}>Judul Proposal</Text>
            <Text style={[styles.cell, styles.colCat]}>Inovator / Unit Kerja</Text>
            <Text style={[styles.cell, styles.colScore]}>Rata-rata Skor</Text>
            <Text style={[styles.cell, styles.colClass]}>Kategori</Text>
          </View>
          
          {proposals.map((p) => (
            <View key={p.id} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.colNo]}>{p.rank ? `${p.rank}${p.isTieBreak ? '*' : ''}` : '-'}</Text>
              <Text style={[styles.cell, styles.colTitle]}>{p.title}</Text>
              <View style={[styles.cell, styles.colCat]}>
                <Text style={{ fontWeight: 'bold' }}>{p.proposerName}</Text>
                <Text style={{ fontSize: 7, color: p.proposerUnitKerja ? '#4b5563' : '#9ca3af', marginTop: 1 }}>
                  Unit: {p.proposerUnitKerja || '-'}
                </Text>
                <Text style={{ fontSize: 7, color: p.proposerNik ? '#4b5563' : '#9ca3af', marginTop: 1 }}>
                  NIK: {p.proposerNik || '-'}
                </Text>
              </View>
              <Text style={[styles.cell, styles.colScore]}>{p.totalScore}</Text>
              <Text style={[styles.cell, styles.colClass]}>{p.category}</Text>
            </View>
          ))}
        </View>

        {/* Wrap closing paragraph, Ditetapkan di, group title, and judge signatures together */}
        <View wrap={false} style={{ marginTop: 15 }}>
          <Text style={styles.paragraph}>
            Demikian berita acara ini dibuat untuk digunakan sebagaimana mestinya. Hasil pemeringkatan bersifat mutlak berdasarkan hasil penilaian yang telah disepakati oleh Dewan Juri Regional.
          </Text>

          <View style={styles.signatureSection}>
            <View style={styles.establishedRight}>
              <Text style={{ fontWeight: 'bold' }}>Ditetapkan di {cityName}, {dateStr}</Text>
            </View>

            <Text style={styles.groupTitleCentered}>
              Dewan Juri Regional PIA Season 12 tahun 2026 grup {regionName}
            </Text>

            <View style={styles.signatureContainer}>
              {judges.map(judge => (
                <View key={judge.id} style={styles.signatureBox} wrap={false}>
                  <Text style={styles.sigName}>{judge.name}</Text>
                  <Text style={styles.sigRole}>Juri Regional</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};
