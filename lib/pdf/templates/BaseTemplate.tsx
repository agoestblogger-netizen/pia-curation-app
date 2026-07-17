import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Note: In production, load actual fonts. Using default fonts for simplicity here.
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 10,
    color: '#999',
  },
  table: {
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bfbfbf',
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#f2f2f2',
    fontWeight: 'bold',
  },
  tableCol: {
    width: '25%', // override per template
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bfbfbf',
    padding: 5,
  },
  tableCell: {
    fontSize: 10,
  }
});

export interface BaseReportProps {
  title: string;
  competitionName: string;
  generatedAt: string;
  generatedBy: string;
  documentStatus: string; // DRAFT | INTERNAL | FINAL
  children: React.ReactNode;
}

export function BaseReport({
  title,
  competitionName,
  generatedAt,
  generatedBy,
  documentStatus,
  children
}: BaseReportProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{competitionName}</Text>
        </View>
        
        <View style={styles.content}>
          {children}
        </View>

        <View style={styles.footer}>
          <Text>Status: {documentStatus}</Text>
          <Text>Dicetak pada: {generatedAt} oleh {generatedBy}</Text>
          <Text render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export { styles as baseStyles };
