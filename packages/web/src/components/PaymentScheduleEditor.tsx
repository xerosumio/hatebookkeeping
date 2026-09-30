import { Plus, Trash2 } from 'lucide-react';
import type { PaymentMilestone } from '../types';
import { centsToDecimal } from '../utils/money';

interface Props {
  schedule: PaymentMilestone[];
  total: number;
  onChange: (schedule: PaymentMilestone[]) => void;
}

export default function PaymentScheduleEditor({ schedule, total, onChange }: Props) {
  function updateItem(index: number, field: keyof PaymentMilestone, value: string | number) {
    const updated = [...schedule];
    const item = { ...updated[index] };

    if (field === 'milestone') {
      item.milestone = value as string;
    } else if (field === 'percentage') {
      item.percentage = Number(value) || 0;
      item.amount = Math.round((total * item.percentage) / 100);
    } else if (field === 'dueDescription') {
      item.dueDescription = value as string;
    }

    updated[index] = item;
    onChange(updated);
  }

  function addItem() {
    onChange([...schedule, { milestone: '', percentage: 0, amount: 0, dueDescription: '' }]);
  }

  function removeItem(index: number) {
    onChange(schedule.filter((_, i) => i !== index));
  }

  const totalPercentage = schedule.reduce((sum, m) => sum + m.percentage, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">Payment Schedule</label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus size={14} /> Add Milestone
        </button>
      </div>

      <div className="space-y-2">
        {schedule.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input
              type="text"
              placeholder="Milestone (e.g., Upon signing)"
              value={item.milestone}
              onChange={(e) => updateItem(i, 'milestone', e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="%"
                value={item.percentage || ''}
                onChange={(e) => updateItem(i, 'percentage', e.target.value)}
                min={0}
                max={100}
                className="w-20 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
            <div className="w-28 px-3 py-2 text-sm text-right font-mono text-gray-600">
              {centsToDecimal(item.amount).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
            </div>
            <input
              type="text"
              placeholder="Due description"
              value={item.dueDescription}
              onChange={(e) => updateItem(i, 'dueDescription', e.target.value)}
              className="w-40 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

      {schedule.length > 0 && totalPercentage !== 100 && (
        <p className="text-sm text-amber-600 mt-1">
          Total: {totalPercentage}% (should be 100%)
        </p>
      )}
    </div>
  );
}
