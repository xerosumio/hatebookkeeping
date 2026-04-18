import { Plus, Trash2 } from 'lucide-react';
import type { LineItem } from '../types';
import { decimalToCents, centsToDecimal } from '../utils/money';

interface Props {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}

export default function LineItemEditor({ items, onChange }: Props) {
  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'description') {
      item.description = value as string;
    } else if (field === 'quantity') {
      item.quantity = Number(value) || 0;
      item.amount = decimalToCents(item.quantity * centsToDecimal(item.unitPrice));
    } else if (field === 'unitPrice') {
      item.unitPrice = decimalToCents(Number(value) || 0);
      item.amount = decimalToCents(item.quantity * (Number(value) || 0));
    }

    updated[index] = item;
    onChange(updated);
  }

  function addItem() {
    onChange([...items, { description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">Line Items *</label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus size={14} /> Add Item
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input
              type="text"
              placeholder="Description"
              value={item.description}
              onChange={(e) => updateItem(i, 'description', e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Qty"
              value={item.quantity || ''}
              onChange={(e) => updateItem(i, 'quantity', e.target.value)}
              min={0}
              step={1}
              className="w-20 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Unit Price"
              value={item.unitPrice ? centsToDecimal(item.unitPrice) : ''}
              onChange={(e) => updateItem(i, 'unitPrice', e.target.value)}
              min={0}
              step={0.01}
              className="w-28 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="w-28 px-3 py-2 text-sm text-right font-mono text-gray-600">
              {(centsToDecimal(item.amount)).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
            </div>
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="text-gray-400 hover:text-red-600 py-2"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-gray-400 mt-2">No items. Click "Add Item" to start.</p>
      )}
    </div>
  );
}
