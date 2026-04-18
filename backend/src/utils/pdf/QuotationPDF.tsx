import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './styles.js';
import { formatMoney } from './formatMoney.js';
import type { IQuotation } from '../../models/Quotation.js';

interface Props {
  quotation: IQuotation & { client: { name: string; contactPerson?: string; email?: string; address?: string } };
}

export function QuotationPDF({ quotation: q }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>Naton Lab Limited</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>QUOTATION</Text>
            <Text style={styles.docNumber}>{q.quotationNumber}</Text>
            <Text style={styles.docNumber}>{new Date(q.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>To</Text>
          <Text style={styles.bold}>{q.client.name}</Text>
          {q.client.contactPerson && <Text>{q.client.contactPerson}</Text>}
          {q.client.email && <Text>{q.client.email}</Text>}
          {q.client.address && <Text>{q.client.address}</Text>}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{q.title}</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, styles.bold]}>Description</Text>
            <Text style={[styles.colQty, styles.bold]}>Qty</Text>
            <Text style={[styles.colPrice, styles.bold]}>Unit Price</Text>
            <Text style={[styles.colAmount, styles.bold]}>Amount</Text>
          </View>
          {q.lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatMoney(item.unitPrice)}</Text>
              <Text style={styles.colAmount}>{formatMoney(item.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 10 }}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal:</Text>
            <Text style={styles.totalsValue}>{formatMoney(q.subtotal)}</Text>
          </View>
          {q.discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount:</Text>
              <Text style={styles.totalsValue}>-{formatMoney(q.discount)}</Text>
            </View>
          )}
          <View style={[styles.totalsRow, { marginTop: 4 }]}>
            <Text style={[styles.totalsLabel, styles.totalFinal]}>Total:</Text>
            <Text style={[styles.totalsValue, styles.totalFinal]}>{formatMoney(q.total)}</Text>
          </View>
        </View>

        {q.paymentSchedule.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Payment Schedule</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[{ flex: 1 }, styles.bold]}>Milestone</Text>
                <Text style={[styles.colQty, styles.bold]}>%</Text>
                <Text style={[styles.colAmount, styles.bold]}>Amount</Text>
                <Text style={[{ flex: 1 }, styles.bold]}>Due</Text>
              </View>
              {q.paymentSchedule.map((m, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={{ flex: 1 }}>{m.milestone}</Text>
                  <Text style={styles.colQty}>{m.percentage}%</Text>
                  <Text style={styles.colAmount}>{formatMoney(m.amount)}</Text>
                  <Text style={{ flex: 1 }}>{m.dueDescription}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {q.termsAndConditions && (
          <View>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <Text style={styles.terms}>{q.termsAndConditions}</Text>
          </View>
        )}

        {q.validUntil && (
          <View style={{ marginTop: 10 }}>
            <Text>Valid until: {new Date(q.validUntil).toLocaleDateString()}</Text>
          </View>
        )}

        {(q.companyChopUrl || q.signatureUrl) && (
          <View style={styles.signatureArea}>
            {q.companyChopUrl && (
              <View>
                <Text style={{ marginBottom: 4, color: '#666' }}>Company Chop</Text>
                <Image src={q.companyChopUrl} style={styles.stampImage} />
              </View>
            )}
            {q.signatureUrl && (
              <View>
                <Text style={{ marginBottom: 4, color: '#666' }}>Authorized Signature</Text>
                <Image src={q.signatureUrl} style={styles.sigImage} />
              </View>
            )}
          </View>
        )}

        <Text style={styles.footer}>
          Generated by HateBookkeeping
        </Text>
      </Page>
    </Document>
  );
}
