import { Plus, Trash2 } from 'lucide-react';
import { formatMoney, type DiscountType, type FieldErrors, type LineItemDto } from '@hbk/shared';
import { emptyLine, previewTotals, type DiscountDraft, type LineDraft } from '../lines';
import { Button, Checkbox, Input, MoneyInput, Select } from './ui';

export function LineItemsEditor({
  lines,
  onChange,
  discount,
  onDiscountChange,
  errors,
  allowWaive,
}: {
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  discount: DiscountDraft;
  onDiscountChange: (discount: DiscountDraft) => void;
  errors: FieldErrors;
  allowWaive?: boolean;
}) {
  const totals = previewTotals(lines, discount);
  const update = (index: number, patch: Partial<LineDraft>) => onChange(lines.map((line, at) => (at === index ? { ...line, ...patch } : line)));
  const lineError = (index: number) =>
    errors[`lineItems.${index}.description`] ?? errors[`lineItems.${index}.quantity`] ?? errors[`lineItems.${index}.unitPrice`];

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1fr_90px_150px_130px_36px] gap-2 text-xs font-medium text-ink-faint md:grid">
        <span>Description</span>
        <span>Quantity</span>
        <span>Unit price</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      {lines.map((line, index) => (
        <div key={index}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_90px_150px_130px_36px] md:items-center">
            <Input
              className="col-span-2 md:col-span-1"
              aria-label={`Line ${index + 1} description`}
              placeholder="Description"
              value={line.description}
              invalid={!!errors[`lineItems.${index}.description`]}
              onChange={(event) => update(index, { description: event.target.value })}
            />
            <Input
              aria-label={`Line ${index + 1} quantity`}
              inputMode="decimal"
              value={line.quantity}
              invalid={!!errors[`lineItems.${index}.quantity`]}
              onChange={(event) => update(index, { quantity: event.target.value })}
            />
            <MoneyInput
              aria-label={`Line ${index + 1} unit price`}
              value={line.unitPrice}
              invalid={!!errors[`lineItems.${index}.unitPrice`]}
              onChange={(event) => update(index, { unitPrice: event.target.value })}
            />
            <div className="text-right text-sm tabular-nums text-ink">
              {line.waived ? <span className="text-authored">Waived</span> : formatMoney(totals.lineItems[index]?.amount ?? 0)}
            </div>
            <button
              type="button"
              aria-label={`Remove line ${index + 1}`}
              disabled={lines.length === 1}
              onClick={() => onChange(lines.filter((_, at) => at !== index))}
              className="justify-self-end rounded p-1.5 text-ink-ghost hover:bg-raised disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {allowWaive ? (
            <div className="mt-1">
              <Checkbox label={<span className="text-xs text-ink-faint">Show the price but do not charge it</span>} checked={line.waived} onChange={(waived) => update(index, { waived })} />
            </div>
          ) : null}
          {lineError(index) ? <div className="mt-1 text-xs text-breach">{lineError(index)}</div> : null}
        </div>
      ))}
      {errors.lineItems ? <div className="text-xs text-breach">{errors.lineItems}</div> : null}
      <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...lines, emptyLine()])}>
        Add line
      </Button>

      <div className="ml-auto max-w-sm space-y-2 border-t border-hair pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-faint">Subtotal</span>
          <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-faint">Discount</span>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Discount type"
              className="!w-auto"
              value={discount.type}
              onChange={(event) => onDiscountChange({ type: event.target.value as DiscountType, value: '' })}
            >
              <option value="none">None</option>
              <option value="percent">Percent</option>
              <option value="amount">Amount</option>
            </Select>
            {discount.type !== 'none' ? (
              <Input
                aria-label="Discount value"
                className="!w-28 text-right"
                inputMode="decimal"
                placeholder={discount.type === 'percent' ? '%' : '0.00'}
                value={discount.value}
                invalid={!!errors.discountValue}
                onChange={(event) => onDiscountChange({ ...discount, value: event.target.value })}
              />
            ) : null}
          </div>
        </div>
        {errors.discountValue ? <div className="text-right text-xs text-breach">{errors.discountValue}</div> : null}
        {totals.discount > 0 ? (
          <div className="flex justify-between">
            <span className="text-ink-faint">Less discount</span>
            <span className="tabular-nums">-{formatMoney(totals.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-hair pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}

/** The priced lines of a saved quote or invoice, read-only. */
export function LineItemsTable({ lines, subtotal, discount, total }: { lines: LineItemDto[]; subtotal: number; discount: number; total: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hair text-xs text-ink-faint">
            <th className="px-4 py-2 text-left font-medium">Description</th>
            <th className="px-4 py-2 text-right font-medium">Qty</th>
            <th className="px-4 py-2 text-right font-medium">Unit price</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} className="border-b border-hair/60">
              <td className="whitespace-pre-wrap px-4 py-2">{line.description}</td>
              <td className="px-4 py-2 text-right tabular-nums">{line.quantity}</td>
              <td className={`px-4 py-2 text-right tabular-nums ${line.waived ? 'text-ink-ghost line-through' : ''}`}>{formatMoney(line.unitPrice)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{line.waived ? <span className="text-authored">Waived</span> : formatMoney(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {discount > 0 ? (
            <>
              <tr>
                <td colSpan={3} className="px-4 pt-3 text-right text-ink-faint">
                  Subtotal
                </td>
                <td className="px-4 pt-3 text-right tabular-nums">{formatMoney(subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-4 py-1 text-right text-ink-faint">
                  Discount
                </td>
                <td className="px-4 py-1 text-right tabular-nums">-{formatMoney(discount)}</td>
              </tr>
            </>
          ) : null}
          <tr className="font-semibold">
            <td colSpan={3} className="px-4 py-3 text-right">
              Total
            </td>
            <td className="px-4 py-3 text-right tabular-nums">{formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
