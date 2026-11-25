import React from 'react';
import { Image, Link, Text, View } from '@react-pdf/renderer';
import { createStyles, styles as defaultStyles } from './styles.js';
import type { PdfCompany, PdfParty } from './types.js';

export type PdfStyles = typeof defaultStyles;

export function stylesFor(company: PdfCompany): PdfStyles {
  return company.brandColor ? createStyles(company.brandColor) : defaultStyles;
}

const bareSite = (website: string) => website.replace(/^https?:\/\//, '');

export function Header({
  styles,
  company,
  title,
  number,
  watermark,
}: {
  styles: PdfStyles;
  company: PdfCompany;
  title: string;
  number: string;
  watermark?: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {company.logo ? <Image src={company.logo} style={styles.logo} /> : null}
        <View style={styles.companyBlock}>
          <Text style={styles.companyName}>{company.name}</Text>
          {company.address ? <Text style={styles.companyDetail}>{company.address}</Text> : null}
          {company.phone ? <Text style={styles.companyDetail}>{company.phone}</Text> : null}
          {company.email ? <Text style={styles.companyDetail}>{company.email}</Text> : null}
          {company.website ? (
            <Link src={company.website} style={styles.companyDetail}>
              {bareSite(company.website)}
            </Link>
          ) : null}
        </View>
      </View>
      <View style={styles.headerRight}>
        <View style={styles.docTitleWrap}>
          <Text style={styles.docTitle}>{title}</Text>
        </View>
        <Text style={styles.docNumber}># {number}</Text>
        {watermark ? (
          <Text style={{ marginTop: 4, fontSize: 9, fontWeight: 'bold', color: '#dc2626', textAlign: 'right' }}>
            {watermark}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function PartyBlock({ styles, label, party }: { styles: PdfStyles; label: string; party: PdfParty }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.clientBlock}>
        <Text style={styles.clientName}>{party.name}</Text>
        {party.contactPerson ? <Text style={styles.clientDetail}>{party.contactPerson}</Text> : null}
        {party.email ? <Text style={styles.clientDetail}>{party.email}</Text> : null}
        {party.address ? <Text style={styles.clientDetail}>{party.address}</Text> : null}
      </View>
    </View>
  );
}

export function MetaRow({ styles, label, value }: { styles: PdfStyles; label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export function TextSection({ styles, title, body }: { styles: PdfStyles; title: string; body: string }) {
  if (!body) return null;
  return (
    <View wrap={false} style={{ marginTop: 16 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.bodyText}>{body}</Text>
    </View>
  );
}

/** The company's chop and signature, as printed on invoices and receipts. */
export function ChopAndSignature({ styles, company }: { styles: PdfStyles; company: PdfCompany }) {
  if (!company.chop && !company.signature) return null;
  return (
    <View wrap={false} style={styles.signatureArea}>
      {company.chop ? (
        <View>
          <Text style={{ marginBottom: 4, fontSize: 8, color: '#64748b' }}>Company Chop</Text>
          <Image src={company.chop} style={styles.stampImage} />
        </View>
      ) : null}
      {company.signature ? (
        <View>
          <Text style={{ marginBottom: 4, fontSize: 8, color: '#64748b' }}>Authorized Signature</Text>
          <Image src={company.signature} style={styles.sigImage} />
        </View>
      ) : null}
    </View>
  );
}

export function Footer({ styles, company }: { styles: PdfStyles; company: PdfCompany }) {
  return (
    <Text style={styles.footer} fixed>
      {company.name}
      {company.website ? `  |  ${bareSite(company.website)}` : ''}
    </Text>
  );
}
