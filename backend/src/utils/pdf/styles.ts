import { StyleSheet, Font } from '@react-pdf/renderer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(__dirname, 'fonts/Inter-Regular.otf'), fontWeight: 'normal' },
    { src: path.join(__dirname, 'fonts/Inter-Medium.otf'), fontWeight: 'medium' },
    { src: path.join(__dirname, 'fonts/Inter-Bold.otf'), fontWeight: 'bold' },
  ],
});

const ACCENT = '#0369a1';
const TEXT = '#1e293b';
const MUTED = '#64748b';
const BORDER = '#cbd5e1';
const LIGHT_BG = '#f8fafc';

export const styles = StyleSheet.create({
  page: {
    padding: 48,
    paddingBottom: 60,
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 'normal',
    color: TEXT,
    lineHeight: 1.5,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 60,
    height: 60,
    objectFit: 'contain',
  },
  companyBlock: {
    flex: 1,
  },
  companyName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: TEXT,
    marginBottom: 2,
  },
  companyDetail: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.6,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docTitleWrap: {
    marginBottom: 4,
    paddingBottom: 2,
  },
  docTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ACCENT,
    textAlign: 'right',
  },
  docNumber: {
    fontSize: 8,
    color: MUTED,
    textAlign: 'right',
  },

  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  metaCol: {
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 8,
    color: MUTED,
    width: 70,
  },
  metaValue: {
    fontSize: 9,
    fontWeight: 'medium',
    color: TEXT,
  },

  sectionLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  clientBlock: {
    marginBottom: 4,
  },
  clientName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: TEXT,
    marginBottom: 2,
  },
  clientDetail: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.5,
  },

  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: TEXT,
    borderBottomWidth: 1,
    borderBottomColor: TEXT,
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: TEXT,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  colNum: { width: 24, textAlign: 'center' },
  colDesc: { flex: 1 },
  colQty: { width: 45, textAlign: 'right' },
  colPrice: { width: 90, textAlign: 'right' },
  colAmount: { width: 90, textAlign: 'right' },

  bold: { fontWeight: 'bold' },
  medium: { fontWeight: 'medium' },
  right: { textAlign: 'right' },

  totalsBlock: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  totalsLabel: {
    width: 100,
    textAlign: 'right',
    marginRight: 12,
    fontSize: 9,
    color: MUTED,
  },
  totalsValue: {
    width: 90,
    textAlign: 'right',
    fontSize: 9,
    color: TEXT,
  },
  totalBanner: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: ACCENT,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 3,
    marginTop: 4,
  },
  totalBannerLabel: {
    width: 100,
    textAlign: 'right',
    marginRight: 12,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  totalBannerValue: {
    width: 90,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    width: 80,
    color: MUTED,
    fontSize: 9,
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
  },

  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: TEXT,
    marginBottom: 4,
    marginTop: 20,
  },
  bodyText: {
    fontSize: 8,
    color: '#475569',
    lineHeight: 1.6,
  },

  signatureArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
  },
  stampImage: {
    width: 90,
    height: 90,
    objectFit: 'contain',
  },
  sigImage: {
    width: 150,
    height: 55,
    objectFit: 'contain',
  },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 7,
    color: MUTED,
    textAlign: 'center',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
  },
});
