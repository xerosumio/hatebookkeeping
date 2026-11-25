import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { formatMoney } from '@hbk/shared';
import { ChopAndSignature, Footer, Header, MetaRow, PartyBlock, TextSection, stylesFor } from './parts.js';
import type { InvoicePdfData, PdfCompany } from './types.js';

export function InvoicePDF({ invoice: inv, company }: { invoice: InvoicePdfData; company: PdfCompany }) {
  const styles = stylesFor(company);

  return (
    <Document title={`Invoice ${inv.number}`}>
      <Page size="A4" style={styles.page}>
        <Header styles={styles} company={company} title="INVOICE" number={inv.number} watermark={inv.watermark} />

        <View style={styles.metaSection}>
          <View style={styles.metaCol}>
            <MetaRow styles={styles} label="Invoice Date" value={inv.issueDate} />
            <MetaRow styles={styles} label="Due Date" value={inv.dueDate} />
            <MetaRow styles={styles} label="Quote" value={inv.quoteNumber} />
            <MetaRow styles={styles} label="Milestone" value={inv.milestoneLabel} />
          </View>
          <PartyBlock styles={styles} label="Bill To" party={inv.client} />
        </View>

        {inv.title ? (
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 8, color: '#64748b' }}>Subject</Text>
            <Text style={{ fontSize: 10, fontWeight: 'medium', color: '#1e293b' }}>{inv.title}</Text>
          </View>
        ) : null}

        <View style={styles.table}>
          <View style={styles.tableHeader} wrap={false}>
            <Text style={[styles.colNum, styles.tableHeaderText]}>#</Text>
            <Text style={[styles.colDesc, styles.tableHeaderText]}>Item & Description</Text>
            <Text style={[styles.colQty, styles.tableHeaderText]}>Qty</Text>
            <Text style={[styles.colPrice, styles.tableHeaderText]}>Rate</Text>
            <Text style={[styles.colAmount, styles.tableHeaderText]}>Amount</Text>
          </View>
          {inv.lines.map((item, i) => (
            <View key={i} wrap={false} style={styles.tableRow}>
              <Text style={styles.colNum}>{i + 1}</Text>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={[styles.colPrice, item.waived ? { textDecoration: 'line-through', color: '#94a3b8' } : {}]}>
                {formatMoney(item.unitPrice)}
              </Text>
              <Text style={[styles.colAmount, styles.medium, item.waived ? { color: '#16a34a' } : {}]}>
                {item.waived ? 'WAIVED' : formatMoney(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        <View wrap={false} style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Sub Total</Text>
            <Text style={styles.totalsValue}>{formatMoney(inv.subtotal)}</Text>
          </View>
          {inv.discount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={[styles.totalsValue, { color: '#dc2626' }]}>-{formatMoney(inv.discount)}</Text>
            </View>
          ) : null}
          <View style={styles.totalBanner}>
            <Text style={styles.totalBannerLabel}>Total</Text>
            <Text style={styles.totalBannerValue}>{formatMoney(inv.total)}</Text>
          </View>
          {inv.amountPaid > 0 ? (
            <>
              <View style={[styles.totalsRow, { marginTop: 8 }]}>
                <Text style={styles.totalsLabel}>Payment Made</Text>
                <Text style={[styles.totalsValue, { color: '#16a34a' }]}>-{formatMoney(inv.amountPaid)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, styles.bold]}>Balance Due</Text>
                <Text style={[styles.totalsValue, styles.bold, { color: inv.amountDue > 0 ? '#dc2626' : '#16a34a' }]}>
                  {formatMoney(inv.amountDue)}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        <TextSection styles={styles} title="Bank Details" body={inv.bankDetails} />
        <TextSection styles={styles} title="Notes" body={inv.notes} />

        {inv.watermark ? null : <ChopAndSignature styles={styles} company={company} />}
        <Footer styles={styles} company={company} />
      </Page>
    </Document>
  );
}
