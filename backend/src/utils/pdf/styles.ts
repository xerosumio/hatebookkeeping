import { StyleSheet } from '@react-pdf/renderer';

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  companyName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#111',
  },
  docTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    color: '#111',
  },
  docNumber: {
    fontSize: 10,
    textAlign: 'right',
    color: '#666',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111',
    marginBottom: 6,
    marginTop: 16,
  },
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  colDesc: { flex: 1 },
  colQty: { width: 50, textAlign: 'right' },
  colPrice: { width: 80, textAlign: 'right' },
  colAmount: { width: 80, textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },
  right: { textAlign: 'right' },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  totalsLabel: { width: 100, textAlign: 'right', marginRight: 10 },
  totalsValue: { width: 80, textAlign: 'right' },
  totalFinal: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  infoLabel: {
    width: 80,
    color: '#666',
  },
  infoValue: {
    flex: 1,
  },
  terms: {
    marginTop: 16,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  signatureArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  stampImage: {
    width: 100,
    height: 100,
    objectFit: 'contain',
  },
  sigImage: {
    width: 160,
    height: 60,
    objectFit: 'contain',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
});
