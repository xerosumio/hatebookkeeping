import { useState } from 'react';
import type { CompanyDto, NumberingDto } from '@hbk/shared';
import { post, put, useGet, useSave } from '../../shared/api/hooks';
import { ProtectedImage, UploadButton } from '../../shared/components/files';
import { Button, Checkbox, Field, FormGrid, Input, Modal, Notice, Textarea } from '../../shared/components/ui';

type Form = Omit<CompanyDto, 'id'>;

const EMPTY: Form = {
  code: '',
  name: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  brandColor: '',
  bankDetails: '',
  quoteTerms: '',
  logoFileId: null,
  chopFileId: null,
  signatureFileId: null,
  active: true,
};

function ImageSlot({ label, hint, fileId, onChange, error }: { label: string; hint: string; fileId: string | null; onChange: (id: string | null) => void; error?: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-ink-dim">{label}</div>
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-hair-lit bg-raised">
        {fileId ? <ProtectedImage fileId={fileId} alt={label} className="max-h-20 max-w-full object-contain" /> : <span className="text-xs text-ink-ghost">None</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <UploadButton purpose="branding" accept="image/png,image/jpeg" label={fileId ? 'Replace' : 'Upload'} onUploaded={(file) => onChange(file.id)} />
        {fileId ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            Remove
          </Button>
        ) : null}
      </div>
      {error ? <div className="mt-1 text-xs text-breach">{error}</div> : <div className="mt-1 text-xs text-ink-ghost">{hint}</div>}
    </div>
  );
}

function Numbering({ companyId }: { companyId: string }) {
  const current = useGet<NumberingDto>(`/companies/${companyId}/numbering`);
  const [draft, setDraft] = useState<{ quote: string; invoice: string; receipt: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const values = draft ?? {
    quote: String(current.data?.quote ?? ''),
    invoice: String(current.data?.invoice ?? ''),
    receipt: String(current.data?.receipt ?? ''),
  };
  const save = useSave(
    () => put(`/companies/${companyId}/numbering`, { quote: Number(values.quote), invoice: Number(values.invoice), receipt: Number(values.receipt) }),
    () => {
      setDraft(null);
      setSaved(true);
    },
  );
  if (!current.data) return null;

  const field = (key: 'quote' | 'invoice' | 'receipt', label: string) => (
    <Field label={label} error={save.failure?.fields[key]}>
      <Input
        type="number"
        min={1}
        value={values[key]}
        invalid={!!save.failure?.fields[key]}
        onChange={(event) => {
          setSaved(false);
          setDraft({ ...values, [key]: event.target.value });
        }}
      />
    </Field>
  );

  return (
    <div className="rounded-md border border-hair p-3">
      <div className="text-sm font-medium text-ink">Next document numbers for {current.data.year}</div>
      <div className="mb-3 text-xs text-ink-faint">Raise these to carry on from the numbers you have already used. They cannot be lowered.</div>
      <FormGrid columns={3}>
        {field('quote', 'Next quote')}
        {field('invoice', 'Next invoice')}
        {field('receipt', 'Next receipt')}
      </FormGrid>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" busy={save.busy} disabled={!draft} onClick={() => void save.run()}>
          Save numbers
        </Button>
        {saved ? <span className="text-xs text-authored">Saved.</span> : null}
        {save.failure && Object.keys(save.failure.fields).length === 0 ? <span className="text-xs text-breach">{save.failure.message}</span> : null}
      </div>
    </div>
  );
}

export function CompanyForm({ company, onClose }: { company: CompanyDto | null; onClose: () => void }) {
  const [form, setForm] = useState<Form>(company ?? EMPTY);
  const save = useSave(() => (company ? put(`/companies/${company.id}`, form) : post('/companies', form)), onClose);
  const errors = save.failure?.fields ?? {};
  const text = (key: keyof Form) => ({
    value: form[key] as string,
    invalid: !!errors[key],
    onChange: (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <Modal
      wide
      title={company ? company.name : 'Add a company'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={save.busy} onClick={() => void save.run()}>
            Save company
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Company name" error={errors.name}>
          <Input {...text('name')} />
        </Field>
        <Field label="Short code" error={errors.code} hint="Starts every document number, e.g. AX-INV-2026-0001">
          <Input {...text('code')} maxLength={6} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input {...text('email')} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input {...text('phone')} />
        </Field>
        <Field label="Website" error={errors.website}>
          <Input {...text('website')} placeholder="https://" />
        </Field>
        <Field label="Document colour" error={errors.brandColor} hint="Used on PDFs. Leave empty for the default blue.">
          <Input {...text('brandColor')} placeholder="#0369a1" />
        </Field>
      </FormGrid>
      <Field label="Address" error={errors.address}>
        <Textarea {...text('address')} rows={2} />
      </Field>
      <Field label="Bank details" error={errors.bankDetails} hint="Printed on invoices so clients know where to pay.">
        <Textarea {...text('bankDetails')} rows={4} />
      </Field>
      <Field label="Standard quote terms" error={errors.quoteTerms} hint="Filled in on each new quote; can be changed per quote.">
        <Textarea {...text('quoteTerms')} rows={4} />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <ImageSlot label="Logo" hint="PNG or JPEG" fileId={form.logoFileId} error={errors.logoFileId} onChange={(id) => setForm((current) => ({ ...current, logoFileId: id }))} />
        <ImageSlot label="Company chop" hint="Printed on approved quotes, invoices and receipts" fileId={form.chopFileId} error={errors.chopFileId} onChange={(id) => setForm((current) => ({ ...current, chopFileId: id }))} />
        <ImageSlot label="Signature" hint="Printed next to the chop" fileId={form.signatureFileId} error={errors.signatureFileId} onChange={(id) => setForm((current) => ({ ...current, signatureFileId: id }))} />
      </div>
      {company ? <Numbering companyId={company.id} /> : <div className="text-xs text-ink-faint">Document numbers can be set after the company is saved.</div>}
      {company ? (
        <div>
          <Checkbox label="In use" checked={form.active} onChange={(active) => setForm({ ...form, active })} />
          <div className="text-xs text-ink-faint">Switch off to stop new records being filed under this company. Existing records stay.</div>
        </div>
      ) : null}
      {save.failure ? <Notice tone="error">{save.failure.message}</Notice> : null}
    </Modal>
  );
}
