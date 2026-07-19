import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts if needed, assuming the project uses standard fonts or we just stick to defaults.
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
  tableColJudul: { width: '45%', padding: 5, borderRightWidth: 1, borderRightColor: '#bfbfbf' },
  tableColInovator: { width: '27%', padding: 5, borderRightWidth: 1, borderRightColor: '#bfbfbf' },
  tableColKategori: { width: '20%', padding: 5 },
  tableCell: { fontSize: 9 },
  signatureSection: { marginTop: 30 },
  signatureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  signatureBox: { width: '30%', marginBottom: 40, alignItems: 'center' },
  signatureLine: { width: '80%', borderBottomWidth: 1, borderBottomColor: '#000', marginTop: 40, marginBottom: 5 },
  signatureName: { fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  signatureRole: { fontSize: 8, textAlign: 'center', color: '#666' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#999' }
});

interface FgdBeritaAcaraProps {
  competitionName: string;
  sessionName: string;
  scopeText: string;
  generatedAt: string;
  generatedBy: string;
  proposals: Array<{
    id: number;
    title: string;
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
  sessionName,
  scopeText,
  generatedAt,
  generatedBy,
  proposals,
  participants
}: FgdBeritaAcaraProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>BERITA ACARA PENETAPAN HASIL FGD</Text>
        <Text style={styles.subtitle}>{competitionName}</Text>
      </View>

      <View style={styles.metadata}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Nama Sesi FGD</Text>
          <Text style={styles.metaValue}>: {sessionName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Lingkup (Scope)</Text>
          <Text style={styles.metaValue}>: {scopeText}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Tanggal Terbit</Text>
          <Text style={styles.metaValue}>: {generatedAt}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>1. DAFTAR KANDIDAT YANG DITETAPKAN</Text>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <View style={styles.tableColNo}><Text style={styles.tableCell}>No</Text></View>
          <View style={styles.tableColJudul}><Text style={styles.tableCell}>Judul Proposal</Text></View>
          <View style={styles.tableColInovator}><Text style={styles.tableCell}>Inovator</Text></View>
          <View style={styles.tableColKategori}><Text style={styles.tableCell}>Kategori</Text></View>
        </View>
        {proposals.map((p, idx) => (
          <View style={styles.tableRow} key={p.id}>
            <View style={styles.tableColNo}><Text style={styles.tableCell}>{idx + 1}</Text></View>
            <View style={styles.tableColJudul}><Text style={styles.tableCell}>{p.title}</Text></View>
            <View style={styles.tableColInovator}><Text style={styles.tableCell}>{p.proposerName}</Text></View>
            <View style={styles.tableColKategori}><Text style={styles.tableCell}>{p.category}</Text></View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>2. DAFTAR PESERTA FGD / TIM KURATOR</Text>
      <View style={styles.signatureSection}>
        <View style={styles.signatureGrid}>
          {participants.map((person, idx) => (
            <View style={styles.signatureBox} key={idx}>
              <View style={styles.signatureLine}></View>
              <Text style={styles.signatureName}>{person.name}</Text>
              <Text style={styles.signatureRole}>{person.role}</Text>
            </View>
          ))}
          {participants.length === 0 && (
            <Text style={{ fontStyle: 'italic', color: '#999' }}>Tidak ada data partisipan yang tercatat di sistem.</Text>
          )}
        </View>
      </View>

      <Text style={styles.footer}>
        Dokumen ini di-generate secara otomatis dari sistem pada {generatedAt} oleh {generatedBy}.
      </Text>
    </Page>
  </Document>
);
