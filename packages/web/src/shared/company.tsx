import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CompanyDto } from '@hbk/shared';
import { useGet } from './api/hooks';
import { useAuth } from './auth';
import { Field, Select } from './components/ui';

const STORAGE_KEY = 'hbk-company';

interface CompanyState {
  /** Companies still in use. */
  companies: CompanyDto[];
  /** Every company, including ones switched off, for showing old records. */
  all: CompanyDto[];
  /** The company lists and reports are narrowed to; '' means all of them. */
  selectedId: string;
  select: (id: string) => void;
  /** The company a new record should start with. */
  defaultId: string;
  loaded: boolean;
}

const CompanyContext = createContext<CompanyState | null>(null);

function stored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { can } = useAuth();
  const query = useGet<CompanyDto[]>(can('companies.view') || can('claims.own') ? '/companies' : null);
  const [chosen, setChosen] = useState(stored);

  const value = useMemo<CompanyState>(() => {
    const all = query.data ?? [];
    const companies = all.filter((company) => company.active);
    const selectedId = companies.some((company) => company.id === chosen) ? chosen : '';
    return {
      companies,
      all,
      selectedId,
      select: (id) => {
        setChosen(id);
        try {
          localStorage.setItem(STORAGE_KEY, id);
        } catch {
          /* private mode */
        }
      },
      defaultId: selectedId || companies[0]?.id || '',
      loaded: query.isSuccess,
    };
  }, [query.data, query.isSuccess, chosen]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCompanies(): CompanyState {
  const value = useContext(CompanyContext);
  if (!value) throw new Error('useCompanies must be used inside CompanyProvider');
  return value;
}

/** Narrows lists and reports to one company. Hidden while there is only one. */
export function CompanyPicker() {
  const { companies, selectedId, select } = useCompanies();
  if (companies.length < 2) return null;
  return (
    <Select aria-label="Company" value={selectedId} onChange={(event) => select(event.target.value)}>
      <option value="">All companies</option>
      {companies.map((company) => (
        <option key={company.id} value={company.id}>
          {company.name}
        </option>
      ))}
    </Select>
  );
}

/** The company choice on a form. Hidden while there is only one company. */
export function CompanyField({ value, onChange, error, disabled }: { value: string; onChange: (id: string) => void; error?: string; disabled?: boolean }) {
  const { companies, all } = useCompanies();
  const options = companies.some((company) => company.id === value) || !value ? companies : [...companies, ...all.filter((company) => company.id === value)];
  if (all.length === 0) {
    return (
      <Field label="Company" error="No company is set up yet. An admin adds one under Settings.">
        <Select disabled invalid>
          <option>None</option>
        </Select>
      </Field>
    );
  }
  if (options.length < 2 && !error) return null;
  return (
    <Field label="Company" error={error}>
      <Select value={value} disabled={disabled} invalid={!!error} onChange={(event) => onChange(event.target.value)}>
        {value ? null : <option value="">Choose a company</option>}
        {options.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
