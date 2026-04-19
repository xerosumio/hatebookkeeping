import React from 'react';
import { Document, Page, Text, View, Image, Link } from '@react-pdf/renderer';
import { styles } from './styles.js';
import { formatMoney } from './formatMoney.js';
import type { IQuotation } from '../../models/Quotation.js';

export interface CompanyInfo {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  logoUrl: string;
}

interface Props {
  quotation: IQuotation & { client: { name: string; contactPerson?: string; email?: string; address?: string } };
  company: CompanyInfo;
}

export function QuotationPDF({ quotation: q, company }: Props) {
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const issuedDate = fmtDate(q.createdAt);
  const validDate = q.validUntil ? fmtDate(q.validUntil) : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {company.logoUrl ? <Image src={company.logoUrl} style={styles.logo} /> : null}
            <View style={styles.companyBlock}>
              <Text style={styles.companyName}>{company.companyName}</Text>
              {company.companyAddress ? <Text style={styles.companyDetail}>{company.companyAddress}</Text> : null}
              {company.companyPhone ? <Text style={styles.companyDetail}>{company.companyPhone}</Text> : null}
              {company.companyEmail ? <Text style={styles.companyDetail}>{company.companyEmail}</Text> : null}
              {company.companyWebsite ? (
                <Link src={company.companyWebsite} style={styles.companyDetail}>
                  {company.companyWebsite.replace(/^https?:\/\//, '')}
                </Link>
              ) : null}
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.docTitleWrap}>
              <Text style={styles.docTitle}>QUOTE</Text>
            </View>
            <Text style={styles.docNumber}># {q.quotationNumber}</Text>
          </View>
        </View>

        {/* ── Meta section: dates left, bill-to right ── */}
        <View style={styles.metaSection}>
          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Quote Date</Text>
              <Text style={styles.metaValue}>{issuedDate}</Text>
            </View>
            {validDate && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Expiry Date</Text>
                <Text style={styles.metaValue}>{validDate}</Text>
              </View>
            )}
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <View style={styles.clientBlock}>
              <Text style={styles.clientName}>{q.client.name}</Text>
              {q.client.contactPerson && <Text style={styles.clientDetail}>{q.client.contactPerson}</Text>}
              {q.client.email && <Text style={styles.clientDetail}>{q.client.email}</Text>}
              {q.client.address && <Text style={styles.clientDetail}>{q.client.address}</Text>}
            </View>
          </View>
        </View>

        {/* ── Subject ── */}
        {q.title && (
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 8, color: '#64748b' }}>Subject</Text>
            <Text style={{ fontSize: 10, fontWeight: 'medium', color: '#1e293b' }}>{q.title}</Text>
          </View>
        )}

        {/* ── Line Items Table ── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colNum, styles.tableHeaderText]}>#</Text>
            <Text style={[styles.colDesc, styles.tableHeaderText]}>Item & Description</Text>
            <Text style={[styles.colQty, styles.tableHeaderText]}>Qty</Text>
            <Text style={[styles.colPrice, styles.tableHeaderText]}>Rate</Text>
            <Text style={[styles.colAmount, styles.tableHeaderText]}>Amount</Text>
          </View>
          {q.lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colNum}>{i + 1}</Text>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={[styles.colPrice, item.waived ? { textDecoration: 'line-through', color: '#94a3b8' } : {}]}>{formatMoney(item.unitPrice)}</Text>
              <Text style={[styles.colAmount, styles.medium, item.waived ? { color: '#16a34a' } : {}]}>
                {item.waived ? 'WAIVED' : formatMoney(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Totals ── */}
        <View wrap={false} style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Sub Total</Text>
            <Text style={styles.totalsValue}>{formatMoney(q.subtotal)}</Text>
          </View>
          {q.discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount{(q as any).discountPercent ? ` (${(q as any).discountPercent}%)` : ''}</Text>
              <Text style={[styles.totalsValue, { color: '#dc2626' }]}>-{formatMoney(q.discount)}</Text>
            </View>
          )}
          <View style={styles.totalBanner}>
            <Text style={styles.totalBannerLabel}>Total</Text>
            <Text style={styles.totalBannerValue}>{formatMoney(q.total)}</Text>
          </View>
        </View>

        {/* ── Payment Schedule ── */}
        {q.paymentSchedule.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Payment Schedule</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colNum, styles.tableHeaderText]}>#</Text>
                <Text style={[{ flex: 1 }, styles.tableHeaderText]}>Milestone</Text>
                <Text style={[{ width: 35, textAlign: 'right' }, styles.tableHeaderText]}>%</Text>
                <Text style={[{ width: 90, textAlign: 'right' }, styles.tableHeaderText]}>Amount</Text>
                <Text style={[{ width: 120, paddingLeft: 10 }, styles.tableHeaderText]}>Due</Text>
              </View>
              {q.paymentSchedule.map((m, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.colNum}>{i + 1}</Text>
                  <Text style={[{ flex: 1 }, styles.medium]}>{m.milestone}</Text>
                  <Text style={{ width: 35, textAlign: 'right' }}>{m.percentage}%</Text>
                  <Text style={[{ width: 90, textAlign: 'right' }, styles.medium]}>{formatMoney(m.amount)}</Text>
                  <Text style={{ width: 120, paddingLeft: 10, color: '#64748b' }}>{m.dueDescription}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Notes ── */}
        {q.notes && (
          <View wrap={false} style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.bodyText}>{q.notes}</Text>
          </View>
        )}

        {/* ── Terms & Conditions ── */}
        {q.termsAndConditions && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <Text style={styles.bodyText}>{q.termsAndConditions}</Text>
          </View>
        )}

        {/* ── Company Chop / Signature ── */}
        {(q.companyChopUrl || q.signatureUrl) && (
          <View wrap={false} style={styles.signatureArea}>
            {q.companyChopUrl && (
              <View>
                <Text style={{ marginBottom: 4, fontSize: 8, color: '#64748b' }}>Company Chop</Text>
                <Image src={q.companyChopUrl} style={styles.stampImage} />
              </View>
            )}
            {q.signatureUrl && (
              <View>
                <Text style={{ marginBottom: 4, fontSize: 8, color: '#64748b' }}>Authorized Signature</Text>
                <Image src={q.signatureUrl} style={styles.sigImage} />
              </View>
            )}
          </View>
        )}

        {/* ── Footer ── */}
        <Text style={styles.footer} fixed>
          {company.companyName}
          {company.companyWebsite ? `  |  ${company.companyWebsite.replace(/^https?:\/\//, '')}` : ''}
        </Text>
      </Page>
    </Document>
  );
}
