import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: { textAlign: 'center', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, textTransform: 'uppercase' },
  subtitle: { fontSize: 11, marginBottom: 5 },
  metadata: { marginBottom: 20 },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { width: 100, fontWeight: 'bold' },
  metaValue: { flex: 1 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginTop: 15, marginBottom: 10, backgroundColor: '#f0f0f0', padding: 4 },
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#bfbfbf', marginBottom: 10 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#bfbfbf' },
  tableHeader: { backgroundColor: '#f9fafb', fontWeight: 'bold' },
  tableColNo: { width: '8%', padding: 5, borderRightWidth: 1, borderRightColor: '#bfbfbf' },
  tableColJudul: { width: '50%', padding: 5, borderRightWidth: 1, borderRightColor: '#bfbfbf' },
  tableColInovator: { width: '42%', padding: 5 },
  tableCell: { fontSize: 9 },
  signatureSection: { marginTop: 40, flexDirection: 'row', justifyContent: 'flex-end' },
  signatureBox: { width: '40%', alignItems: 'center' },
  signatureLine: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#000', marginTop: 50, marginBottom: 5 },
  signatureName: { fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
  signatureRole: { fontSize: 9, textAlign: 'center', color: '#666' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#999' }
});

interface SuratPenetapanProps {
  competitionName: string;
  regionName: string;
  generatedAt: string;
  generatedBy: string;
  curatorName: string;
  proposals: Array<{
    id: number;
    title: string;
    proposerName: string;
    rowNumber: number;
  }>;
}

export const SuratPenetapanRegionalReport = ({
  competitionName,
  regionName,
  generatedAt,
  generatedBy,
  curatorName,
  proposals,
}: SuratPenetapanProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Surat Penetapan Regional Finalis</Text>
        <Text style={styles.subtitle}>{competitionName}</Text>
      </View>

      <View style={styles.metadata}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Grup Regional:</Text>
          <Text style={styles.metaValue}>{regionName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Tanggal Penetapan:</Text>
          <Text style={styles.metaValue}>{generatedAt}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Metode Penetapan:</Text>
          <Text style={styles.metaValue}>Direct-Pick Kurator (Tanpa FGD)</Text>
        </View>
      </View>

      <Text style={{ marginBottom: 10 }}>
        Berdasarkan hasil seleksi oleh Tim Kurator (Regional Lead), berikut adalah 10 (sepuluh) proposal yang ditetapkan sebagai Regional Finalist untuk {regionName} dan berhak melanjutkan ke tahapan seleksi berikutnya:
      </Text>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <View style={styles.tableColNo}><Text style={styles.tableCell}>No.</Text></View>
          <View style={styles.tableColJudul}><Text style={styles.tableCell}>Judul Proposal</Text></View>
          <View style={styles.tableColInovator}><Text style={styles.tableCell}>Inovator / Unit Kerja</Text></View>
        </View>
        
        {proposals.map((p, idx) => (
          <View key={p.id} style={styles.tableRow}>
            <View style={styles.tableColNo}><Text style={styles.tableCell}>{idx + 1}</Text></View>
            <View style={styles.tableColJudul}>
              <Text style={styles.tableCell}>{p.title}</Text>
              <Text style={{ fontSize: 7, color: '#666', marginTop: 2 }}>ID: {p.id} | Ref: {p.rowNumber}</Text>
            </View>
            <View style={styles.tableColInovator}><Text style={styles.tableCell}>{p.proposerName}</Text></View>
          </View>
        ))}
      </View>

      <View style={styles.signatureSection}>
        <View style={styles.signatureBox}>
          <Text style={{ fontSize: 9 }}>Ditetapkan oleh,</Text>
          <Text style={{ fontSize: 9, marginTop: 2 }}>Regional Lead {regionName}</Text>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureName}>{curatorName}</Text>
          <Text style={styles.signatureRole}>Tim Kurator</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Dokumen ini digenerate secara otomatis oleh PIA Curation App pada {generatedAt} oleh {generatedBy}
      </Text>
    </Page>
  </Document>
);
