import React from 'react';
import { Document, Page, Text, View, Image, Link } from '@react-pdf/renderer';
import { styles } from './styles.js';
import { formatMoney } from './formatMoney.js';
import type { IReceipt } from '../../models/Receipt.js';
import type { IInvoice } from '../../models/Invoice.js';

export interface CompanyInfo {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  logoUrl: string;
}

interface PopulatedInvoice extends IInvoice {
  quotation?: { quotationNumber: string; title: string } | null;
}

interface Props {
  receipt: IReceipt & {
    client: { name: string; contactPerson?: string; email?: string; address?: string };
    invoice: PopulatedInvoice;
  };
  company: CompanyInfo;
}

const methodLabels: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  cash: 'Cash',
  fps: 'FPS',
  other: 'Other',
};

export function ReceiptPDF({ receipt: r, company }: Props) {
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const paymentDate = fmtDate(r.paymentDate);
  const inv = r.invoice;
  const quotation = inv?.quotation && typeof inv.quotation === 'object' ? inv.quotation : null;

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
              <Text style={styles.docTitle}>RECEIPT</Text>
            </View>
            <Text style={styles.docNumber}># {r.receiptNumber}</Text>
          </View>
        </View>

        {/* ── Meta + Client ── */}
        <View style={styles.metaSection}>
          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Date</Text>
              <Text style={styles.metaValue}>{paymentDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Method</Text>
              <Text style={styles.metaValue}>{methodLabels[r.paymentMethod] || r.paymentMethod}</Text>
            </View>
            {r.bankReference ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Reference</Text>
                <Text style={styles.metaValue}>{r.bankReference}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.sectionLabel}>Received From</Text>
            <View style={styles.clientBlock}>
              <Text style={styles.clientName}>{r.client.name}</Text>
              {r.client.contactPerson ? <Text style={styles.clientDetail}>{r.client.contactPerson}</Text> : null}
              {r.client.email ? <Text style={styles.clientDetail}>{r.client.email}</Text> : null}
              {r.client.address ? <Text style={styles.clientDetail}>{r.client.address}</Text> : null}
            </View>
          </View>
        </View>

        {/* ── Payment For (project context) ── */}
        <View style={{ marginTop: 4, marginBottom: 16, padding: 12, backgroundColor: '#f8fafc', borderRadius: 3, borderWidth: 0.5, borderColor: '#e2e8f0' }}>
          <Text style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontWeight: 'bold' }}>Payment For</Text>

          {quotation ? (
            <View style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 }}>{quotation.title}</Text>
              <Text style={{ fontSize: 8, color: '#64748b' }}>Quotation: {quotation.quotationNumber}</Text>
            </View>
          ) : null}

          {inv ? (
            <View style={{ flexDirection: 'row', marginTop: quotation ? 4 : 0, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 8 }}>
              <View style={{ width: 120 }}>
                <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 2 }}>Invoice</Text>
                <Text style={{ fontSize: 9, fontWeight: 'medium', color: '#1e293b' }}>{inv.invoiceNumber}</Text>
              </View>
              {inv.milestone ? (
                <View style={{ width: 100 }}>
                  <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 2 }}>Milestone</Text>
                  <Text style={{ fontSize: 9, fontWeight: 'medium', color: '#1e293b' }}>{inv.milestone}</Text>
                </View>
              ) : null}
              <View style={{ width: 110, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 2 }}>Invoice Total</Text>
                <Text style={{ fontSize: 9, fontWeight: 'medium', color: '#1e293b' }}>{formatMoney(inv.total)}</Text>
              </View>
              <View style={{ width: 110, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 2 }}>Balance Due</Text>
                <Text style={{ fontSize: 9, fontWeight: 'medium', color: inv.amountDue > 0 ? '#dc2626' : '#16a34a' }}>{formatMoney(inv.amountDue)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Amount Banner ── */}
        <View style={{ backgroundColor: '#0369a1', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 3, marginTop: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>
            <Text style={{ fontSize: 10 }}>Amount Received    </Text>
            {formatMoney(r.amount)}
          </Text>
        </View>

        {/* ── Notes ── */}
        {r.notes ? (
          <View wrap={false} style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.bodyText}>{r.notes}</Text>
          </View>
        ) : null}

        {/* ── Company Chop / Signature ── */}
        {(r.companyChopUrl || r.signatureUrl) ? (
          <View wrap={false} style={styles.signatureArea}>
            {r.companyChopUrl ? (
              <View>
                <Text style={{ marginBottom: 4, fontSize: 8, color: '#64748b' }}>Company Chop</Text>
                <Image src={r.companyChopUrl} style={styles.stampImage} />
              </View>
            ) : null}
            {r.signatureUrl ? (
              <View>
                <Text style={{ marginBottom: 4, fontSize: 8, color: '#64748b' }}>Authorized Signature</Text>
                <Image src={r.signatureUrl} style={styles.sigImage} />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Footer ── */}
        <Text style={styles.footer} fixed>
          {company.companyName}
          {company.companyWebsite ? `  |  ${company.companyWebsite.replace(/^https?:\/\//, '')}` : ''}
        </Text>
      </Page>
    </Document>
  );
}
