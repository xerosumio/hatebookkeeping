import { useState } from 'react';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@hbk/shared';
import { put, useSave } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { Button, Card, DetailRow, Field, FormGrid, Input, Notice, Page } from '../../shared/components/ui';

export default function Profile() {
  const { me } = useAuth();
  const [form, setForm] = useState({
    bankName: me?.bankName ?? '',
    bankAccountNumber: me?.bankAccountNumber ?? '',
    fpsId: me?.fpsId ?? '',
  });
  const [saved, setSaved] = useState(false);
  const save = useSave(
    () => put('/users/me', form),
    () => setSaved(true),
  );
  if (!me) return null;

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => {
    setSaved(false);
    setForm({ ...form, [key]: event.target.value });
  };

  return (
    <Page title="My details">
      <Card title="Account">
        <DetailRow label="Name">{me.name}</DetailRow>
        <DetailRow label="Email">{me.email}</DetailRow>
        <DetailRow label="Role">
          {ROLE_LABELS[me.role]}
          <div className="text-xs text-ink-faint">{ROLE_DESCRIPTIONS[me.role]}</div>
        </DetailRow>
        <DetailRow label="Approver">{me.isApprover ? 'Yes' : 'No'}</DetailRow>
      </Card>
      <Card title="Where my claims are paid">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save.run();
          }}
        >
          <FormGrid columns={3}>
            <Field label="Bank" error={save.failure?.fields.bankName}>
              <Input value={form.bankName} onChange={set('bankName')} />
            </Field>
            <Field label="Account number" error={save.failure?.fields.bankAccountNumber}>
              <Input value={form.bankAccountNumber} onChange={set('bankAccountNumber')} />
            </Field>
            <Field label="FPS ID" error={save.failure?.fields.fpsId}>
              <Input value={form.fpsId} onChange={set('fpsId')} />
            </Field>
          </FormGrid>
          {save.failure ? <Notice tone="error">{save.failure.message}</Notice> : null}
          {saved ? <Notice tone="success">Saved.</Notice> : null}
          <Button type="submit" variant="primary" busy={save.busy}>
            Save
          </Button>
        </form>
      </Card>
    </Page>
  );
}
