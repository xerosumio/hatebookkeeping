import type { CategoryDto, CategoryType, ClientDto, PayeeDto } from '@hbk/shared';
import { useGet } from '../api/hooks';
import { Field, Select } from './ui';

interface PickerProps {
  value: string;
  onChange: (id: string) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
}

export function ClientPicker({ value, onChange, error, disabled, label = 'Client' }: PickerProps) {
  const clients = useGet<ClientDto[]>('/clients');
  // An archived client stays selectable only on the record that already has it.
  const options = (clients.data ?? []).filter((client) => !client.archived || client.id === value);
  return (
    <Field label={label} error={error} hint={clients.data && options.length === 0 ? 'Add a client first, under Clients.' : undefined}>
      <Select value={value} disabled={disabled} invalid={!!error} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a client</option>
        {options.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
            {client.archived ? ' (archived)' : ''}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function PayeePicker({ value, onChange, error, disabled, label = 'Payee' }: PickerProps) {
  const payees = useGet<PayeeDto[]>('/payees');
  const options = (payees.data ?? []).filter((payee) => !payee.archived || payee.id === value);
  return (
    <Field label={label} error={error} hint={payees.data && options.length === 0 ? 'Add a payee first, under Payees.' : undefined}>
      <Select value={value} disabled={disabled} invalid={!!error} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a payee</option>
        {options.map((payee) => (
          <option key={payee.id} value={payee.id}>
            {payee.name}
            {payee.archived ? ' (archived)' : ''}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Categories a person may file a new line under: in use, and not one the app books to itself. */
export function CategorySelect({
  type,
  value,
  onChange,
  invalid,
  disabled,
  ariaLabel,
}: {
  type: CategoryType;
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const categories = useGet<CategoryDto[]>('/settings/categories');
  const options = (categories.data ?? []).filter((category) => category.type === type && ((category.active && !category.system) || category.id === value));
  return (
    <Select aria-label={ariaLabel} value={value} disabled={disabled} invalid={invalid} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose a category</option>
      {options.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </Select>
  );
}
