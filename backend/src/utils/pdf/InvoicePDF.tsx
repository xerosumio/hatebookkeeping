import React from 'react';
import { Document, Page, Text, View, Image, Link } from '@react-pdf/renderer';
import { styles as defaultStyles, createStyles } from './styles.js';
import { formatMoney } from './formatMoney.js';
import type { IInvoice } from '../../models/Invoice.js';

const TERM_LABELS: Record<string, string> = {
  due_on_receipt: 'Due on Receipt',
  net_7: 'Net 7',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
};

function termsLabel(terms: string): string {
  if (TERM_LABELS[terms]) return TERM_LABELS[terms];
  const m = terms.match(/^custom_(\d+)$/);
  if (m) return `Net ${m[1]}`;
  return terms;
}

export interface CompanyInfo {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  logoUrl: string;
  brandColor?: string;
}

interface Props {
  invoice: IInvoice & { client: { name: string; contactPerson?: string; email?: string; address?: string } };
  company: CompanyInfo;
}

export function InvoicePDF({ invoice: inv, company }: Props) {
  const styles = company.brandColor ? createStyles(company.brandColor) : defaultStyles;
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const issuedDate = fmtDate(inv.createdAt);
  const dueDate = inv.dueDate ? fmtDate(inv.dueDate) : null;

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
              <Text style={styles.docTitle}>INVOICE</Text>
            </View>
            <Text style={styles.docNumber}># {inv.invoiceNumber}</Text>
          </View>
        </View>

        {/* ── Meta section ── */}
        <View style={styles.metaSection}>
          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice Date</Text>
              <Text style={styles.metaValue}>{issuedDate}</Text>
            </View>
            {inv.paymentTerms && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Payment Terms</Text>
                <Text style={styles.metaValue}>{termsLabel(inv.paymentTerms)}</Text>
              </View>
            )}
            {dueDate && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Due Date</Text>
                <Text style={styles.metaValue}>{dueDate}</Text>
              </View>
            )}
            {inv.milestone && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Milestone</Text>
                <Text style={styles.metaValue}>{inv.milestone}</Text>
              </View>
            )}
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <View style={styles.clientBlock}>
              <Text style={styles.clientName}>{inv.client.name}</Text>
              {inv.client.contactPerson && <Text style={styles.clientDetail}>{inv.client.contactPerson}</Text>}
              {inv.client.email && <Text style={styles.clientDetail}>{inv.client.email}</Text>}
              {inv.client.address && <Text style={styles.clientDetail}>{inv.client.address}</Text>}
            </View>
          </View>
        </View>

        {/* ── Line Items Table ── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colNum, styles.tableHeaderText]}>#</Text>
            <Text style={[styles.colDesc, styles.tableHeaderText]}>Item & Description</Text>
            <Text style={[styles.colQty, styles.tableHeaderText]}>Qty</Text>
            <Text style={[styles.colPrice, styles.tableHeaderText]}>Rate</Text>
            <Text style={[styles.colAmount, styles.tableHeaderText]}>Amount</Text>
          </View>
          {inv.lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colNum}>{i + 1}</Text>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatMoney(item.unitPrice)}</Text>
              <Text style={[styles.colAmount, styles.medium]}>{formatMoney(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* ── Totals ── */}
        <View wrap={false} style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Sub Total</Text>
            <Text style={styles.totalsValue}>{formatMoney(inv.subtotal)}</Text>
          </View>
          {inv.discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={[styles.totalsValue, { color: '#dc2626' }]}>-{formatMoney(inv.discount)}</Text>
            </View>
          )}
          <View style={styles.totalBanner}>
            <Text style={styles.totalBannerLabel}>Total</Text>
            <Text style={styles.totalBannerValue}>{formatMoney(inv.total)}</Text>
          </View>
          {inv.amountPaid > 0 && (
            <>
              <View style={[styles.totalsRow, { marginTop: 8 }]}>
                <Text style={styles.totalsLabel}>Payment Made</Text>
                <Text style={[styles.totalsValue, { color: '#16a34a' }]}>-{formatMoney(inv.amountPaid)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, styles.bold]}>Balance Due</Text>
                <Text style={[styles.totalsValue, styles.bold, { color: '#dc2626' }]}>{formatMoney(inv.amountDue)}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Bank Details ── */}
        {inv.bankAccountInfo && (
          <View wrap={false} style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>Bank Details</Text>
            <Text style={styles.bodyText}>{inv.bankAccountInfo}</Text>
          </View>
        )}

        {/* ── Notes ── */}
        {inv.notes && (
          <View wrap={false} style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.bodyText}>{inv.notes}</Text>
          </View>
        )}

        {/* ── Company Chop / Signature ── */}
        {(inv.companyChopUrl || inv.signatureUrl) && (
          <View wrap={false} style={styles.signatureArea}>
            {inv.companyChopUrl && (
              <View>
                <Text style={{ marginBottom: 4, fontSize: 8, color: '#64748b' }}>Company Chop</Text>
                <Image src={inv.companyChopUrl} style={styles.stampImage} />
              </View>
            )}
            {inv.signatureUrl && (
              <View>
                <Text style={{ marginBottom: 4, fontSize: 8, color: '#64748b' }}>Authorized Signature</Text>
                <Image src={inv.signatureUrl} style={styles.sigImage} />
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
