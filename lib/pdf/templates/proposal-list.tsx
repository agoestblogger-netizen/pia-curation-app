import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { BaseReport, baseStyles } from './BaseTemplate';

export interface ProposalReportItem {
  id: number;
  externalId: string | null;
  title: string;
  proposerName: string;
  category: string;
  status: string;
}

export interface ProposalListReportProps {
  competitionName: string;
  generatedAt: string;
  generatedBy: string;
  documentStatus: string;
  proposals: ProposalReportItem[];
}

export function ProposalListReport({
  competitionName,
  generatedAt,
  generatedBy,
  documentStatus,
  proposals
}: ProposalListReportProps) {
  return (
    <BaseReport
      title="Daftar Proposal"
      competitionName={competitionName}
      generatedAt={generatedAt}
      generatedBy={generatedBy}
      documentStatus={documentStatus}
    >
      <View style={baseStyles.table}>
        <View style={[baseStyles.tableRow, baseStyles.tableHeader]}>
          <View style={[baseStyles.tableCol, { width: '15%' }]}><Text style={baseStyles.tableCell}>ID / Ext ID</Text></View>
          <View style={[baseStyles.tableCol, { width: '40%' }]}><Text style={baseStyles.tableCell}>Judul</Text></View>
          <View style={[baseStyles.tableCol, { width: '20%' }]}><Text style={baseStyles.tableCell}>Pengusul</Text></View>
          <View style={[baseStyles.tableCol, { width: '15%' }]}><Text style={baseStyles.tableCell}>Kategori</Text></View>
          <View style={[baseStyles.tableCol, { width: '10%' }]}><Text style={baseStyles.tableCell}>Status</Text></View>
        </View>
        {proposals.map((p, i) => (
          <View style={baseStyles.tableRow} key={i}>
            <View style={[baseStyles.tableCol, { width: '15%' }]}><Text style={baseStyles.tableCell}>{p.id} / {p.externalId || '-'}</Text></View>
            <View style={[baseStyles.tableCol, { width: '40%' }]}><Text style={baseStyles.tableCell}>{p.title}</Text></View>
            <View style={[baseStyles.tableCol, { width: '20%' }]}><Text style={baseStyles.tableCell}>{p.proposerName}</Text></View>
            <View style={[baseStyles.tableCol, { width: '15%' }]}><Text style={baseStyles.tableCell}>{p.category}</Text></View>
            <View style={[baseStyles.tableCol, { width: '10%' }]}><Text style={baseStyles.tableCell}>{p.status}</Text></View>
          </View>
        ))}
      </View>
    </BaseReport>
  );
}
