export type EntityKey = 'ax' | 'nt';

export interface BankAccountConfig {
  fundName: string;
  globalAccountName: string;
  accountNumber: string;
  bankCode: string;
  branchCode: string;
  swiftCode: string;
  bankName: string;
  location: string;
}

export const BANK_ACCOUNTS: Record<EntityKey, BankAccountConfig> = {
  ax: {
    fundName: 'Axilogy Airwallex',
    globalAccountName: 'Axilogy Limited',
    accountNumber: '7950133712',
    bankCode: '016',
    branchCode: '478',
    swiftCode: 'DHBKHKHH',
    bankName: 'DBS Bank (Hong Kong) Limited',
    location: 'Hong Kong SAR',
  },
  nt: {
    fundName: 'Naton Airwallex',
    globalAccountName: 'NATON LAB LIMITED',
    accountNumber: '47412428641',
    bankCode: '003',
    branchCode: '474',
    swiftCode: 'SCBLHKHH',
    bankName: 'Standard Chartered Bank (Hong Kong) Ltd',
    location: 'Hong Kong SAR',
  },
};

export const FUND_NAME: Record<EntityKey, string> = {
  ax: BANK_ACCOUNTS.ax.fundName,
  nt: BANK_ACCOUNTS.nt.fundName,
};

export const ALL_FUND_NAMES = Object.values(FUND_NAME);
