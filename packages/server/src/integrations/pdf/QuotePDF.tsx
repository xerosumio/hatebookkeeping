import React from 'react';
import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import { formatMoney } from '@hbk/shared';
import { Footer, Header, MetaRow, PartyBlock, TextSection, stylesFor } from './parts.js';
import type { PdfCompany, QuotePdfData } from './types.js';

const dashedBox = { borderWidth: 0.5, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 3 } as const;
const smallLabel = { marginBottom: 4, fontSize: 8, color: '#64748b' } as const;

function SignLines() {
  return (
    <View>
      <View style={{ borderBottomWidth: 0.5, borderBottomColor: '#94a3b8', borderStyle: 'dashed', marginBottom: 6, width: 180 }} />
      <Text style={{ fontSize: 8, color: '#64748b' }}>Name: ___________________________</Text>
      <Text style={{ fontSize: 8, color: '#64748b', marginTop: 8 }}>Date: ___________________________</Text>
    </View>
  );
}

export function QuotePDF({ quote: q, company }: { quote: QuotePdfData; company: PdfCompany }) {
  const styles = stylesFor(company);
  // The chop and signature only go on once the quote has been approved.
  const chop = q.draft ? '' : company.chop;
  const signature = q.draft ? '' : company.signature;

  return (
    <Document title={`Quote ${q.number}`}>
      <Page size="A4" style={styles.page}>
        <Header styles={styles} company={company} title="QUOTE" number={q.number} watermark={q.draft ? 'DRAFT - NOT APPROVED' : ''} />

        <View style={styles.metaSection}>
          <View style={styles.metaCol}>
            <MetaRow styles={styles} label="Quote Date" value={q.issueDate} />
            <MetaRow styles={styles} label="Expiry Date" value={q.validUntil} />
          </View>
          <PartyBlock styles={styles} label="Bill To" party={q.client} />
        </View>

        {q.title ? (
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 8, color: '#64748b' }}>Subject</Text>
            <Text style={{ fontSize: 10, fontWeight: 'medium', color: '#1e293b' }}>{q.title}</Text>
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
          {q.lines.map((item, i) => (
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
            <Text style={styles.totalsValue}>{formatMoney(q.subtotal)}</Text>
          </View>
          {q.discount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Discount{q.discountPercent !== null ? ` (${q.discountPercent}%)` : ''}
              </Text>
              <Text style={[styles.totalsValue, { color: '#dc2626' }]}>-{formatMoney(q.discount)}</Text>
            </View>
          ) : null}
          <View style={styles.totalBanner}>
            <Text style={styles.totalBannerLabel}>Total</Text>
            <Text style={styles.totalBannerValue}>{formatMoney(q.total)}</Text>
          </View>
        </View>

        {q.schedule.length > 0 ? (
          <View wrap={q.schedule.length > 6}>
            <Text style={styles.sectionTitle}>Payment Schedule</Text>
            <View style={{ marginTop: 4 }}>
              <View style={styles.tableHeader} wrap={false}>
                <Text style={[styles.colNum, styles.tableHeaderText]}>#</Text>
                <Text style={[{ flex: 1 }, styles.tableHeaderText]}>Milestone</Text>
                <Text style={[{ width: 45, textAlign: 'right' }, styles.tableHeaderText]}>%</Text>
                <Text style={[{ width: 90, textAlign: 'right' }, styles.tableHeaderText]}>Amount</Text>
                <Text style={[{ width: 120, paddingLeft: 10 }, styles.tableHeaderText]}>Due</Text>
              </View>
              {q.schedule.map((m, i) => (
                <View key={i} wrap={false} style={styles.tableRow}>
                  <Text style={styles.colNum}>{i + 1}</Text>
                  <Text style={[{ flex: 1 }, styles.medium]}>{m.label}</Text>
                  <Text style={{ width: 45, textAlign: 'right' }}>{m.percentage}%</Text>
                  <Text style={[{ width: 90, textAlign: 'right' }, styles.medium]}>{formatMoney(m.amount)}</Text>
                  <Text style={{ width: 120, paddingLeft: 10, color: '#64748b' }}>{m.dueDescription}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <TextSection styles={styles} title="Notes" body={q.notes} />
        <TextSection styles={styles} title="Terms & Conditions" body={q.terms} />

        <View wrap={false} style={styles.signatureArea}>
          <View style={{ width: '48%', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 }}>Authorized By</Text>
              {chop ? (
                <View style={{ marginBottom: 8 }}>
                  <Text style={smallLabel}>Company Chop</Text>
                  <Image src={chop} style={styles.stampImage} />
                </View>
              ) : null}
              {signature ? (
                <View style={{ marginBottom: 8 }}>
                  <Text style={smallLabel}>Signature</Text>
                  <Image src={signature} style={styles.sigImage} />
                </View>
              ) : null}
              {!chop && !signature ? <View style={{ height: 80 }} /> : null}
            </View>
            <SignLines />
          </View>

          <View style={{ width: '48%', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 }}>Accepted By</Text>
              <View style={{ marginBottom: 8 }}>
                <Text style={smallLabel}>Company Chop</Text>
                <View style={{ width: 90, height: 90, ...dashedBox }} />
              </View>
              <View style={{ marginBottom: 8 }}>
                <Text style={smallLabel}>Signature</Text>
                <View style={{ width: 150, height: 55, ...dashedBox }} />
              </View>
            </View>
            <SignLines />
          </View>
        </View>

        <Footer styles={styles} company={company} />
      </Page>
    </Document>
  );
}
