import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { formatMoney } from '@hbk/shared';
import { ChopAndSignature, Footer, Header, MetaRow, PartyBlock, TextSection, stylesFor } from './parts.js';
import type { PdfCompany, ReceiptPdfData } from './types.js';

const label = { fontSize: 8, color: '#64748b', marginBottom: 2 } as const;
const value = { fontSize: 9, fontWeight: 'medium', color: '#1e293b' } as const;

export function ReceiptPDF({ receipt: r, company }: { receipt: ReceiptPdfData; company: PdfCompany }) {
  const styles = stylesFor(company);
  const accent = company.brandColor || '#0369a1';

  return (
    <Document title={`Receipt ${r.number}`}>
      <Page size="A4" style={styles.page}>
        <Header styles={styles} company={company} title="RECEIPT" number={r.number} watermark={r.voided ? 'VOID' : ''} />

        <View style={styles.metaSection}>
          <View style={styles.metaCol}>
            <MetaRow styles={styles} label="Payment Date" value={r.date} />
            <MetaRow styles={styles} label="Method" value={r.method} />
            <MetaRow styles={styles} label="Reference" value={r.reference} />
          </View>
          <PartyBlock styles={styles} label="Received From" party={r.client} />
        </View>

        <View
          style={{
            marginTop: 4,
            marginBottom: 16,
            padding: 12,
            backgroundColor: '#f8fafc',
            borderRadius: 3,
            borderWidth: 0.5,
            borderColor: '#e2e8f0',
          }}
        >
          <Text style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontWeight: 'bold' }}>
            Payment For
          </Text>
          {r.invoiceTitle ? (
            <View style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 }}>{r.invoiceTitle}</Text>
              {r.quoteNumber ? <Text style={{ fontSize: 8, color: '#64748b' }}>Quote: {r.quoteNumber}</Text> : null}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 8 }}>
            <View style={{ width: 130 }}>
              <Text style={label}>Invoice</Text>
              <Text style={value}>{r.invoiceNumber}</Text>
            </View>
            {r.milestoneLabel ? (
              <View style={{ width: 110 }}>
                <Text style={label}>Milestone</Text>
                <Text style={value}>{r.milestoneLabel}</Text>
              </View>
            ) : null}
            <View style={{ width: 110, alignItems: 'flex-end' }}>
              <Text style={label}>Invoice Total</Text>
              <Text style={value}>{formatMoney(r.invoiceTotal)}</Text>
            </View>
            <View style={{ width: 110, alignItems: 'flex-end' }}>
              <Text style={label}>Balance Due</Text>
              <Text style={[value, { color: r.balanceDue > 0 ? '#dc2626' : '#16a34a' }]}>{formatMoney(r.balanceDue)}</Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: r.voided ? '#94a3b8' : accent,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 3,
            marginTop: 20,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>
            <Text style={{ fontSize: 10 }}>{r.voided ? 'Voided Payment    ' : 'Amount Received    '}</Text>
            {formatMoney(r.amount)}
          </Text>
        </View>

        <TextSection styles={styles} title="Notes" body={r.notes} />

        {r.voided ? null : <ChopAndSignature styles={styles} company={company} />}
        <Footer styles={styles} company={company} />
      </Page>
    </Document>
  );
}
