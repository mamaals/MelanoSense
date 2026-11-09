import { createElement, type ChangeEvent } from 'react';
import { isAllowedBirthDate, serializeCalendarDate } from '../utils/birthDate';

// Keep the existing web target usable when Metro selects the native field's web counterpart.
export default function BirthDateField({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return createElement('label', {
    style: { display: 'block', marginBottom: 14, fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#2A2A2A' },
  }, 'Tanggal Lahir', createElement('input', {
    type: 'date',
    lang: 'id',
    'aria-label': 'Tanggal Lahir',
    value,
    disabled,
    required: true,
    max: serializeCalendarDate(new Date()) ?? undefined,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      if (!next || isAllowedBirthDate(next)) onChange(next);
    },
    style: {
      display: 'block', boxSizing: 'border-box', width: '100%', minWidth: 0,
      minHeight: 48, padding: 12, marginTop: 6, border: 0, borderRadius: 8,
      background: '#FFFFFF', fontFamily: 'Poppins-Regular', fontSize: 13, color: '#2A2A2A',
    },
  }));
}
