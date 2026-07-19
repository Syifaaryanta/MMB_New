import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number, decimals = 0): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateInput(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function getRoleBadge(role: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    admin: { label: 'Admin', className: 'badge-purple' },
    staff_gudang: { label: 'Staff Gudang', className: 'badge-blue' },
    staff_kantor: { label: 'Staff Kantor', className: 'badge-gray' },
    sales: { label: 'Sales', className: 'badge-green' },
  };
  return map[role] || { label: role, className: 'badge-gray' };
}

export function getStatusBadge(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'badge-yellow' },
    completed: { label: 'Selesai', className: 'badge-green' },
    received: { label: 'Diterima', className: 'badge-blue' },
  };
  return map[status] || { label: status, className: 'badge-gray' };
}

export function parseAmount(val: string): number {
  return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
}

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatRupiahInput(val: string | number): string {
  if (val === undefined || val === null || val === '') return '';
  const isNegative = String(val).startsWith('-');
  const clean = String(val).replace(/[^0-9]/g, '');
  if (!clean) return isNegative ? '-' : '';
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(parseInt(clean, 10));
  return isNegative ? `-${formatted}` : formatted;
}

export function parseRupiahInput(val: string): number {
  if (!val) return 0;
  const isNegative = val.startsWith('-');
  const clean = val.replace(/[^0-9]/g, '');
  const parsed = parseInt(clean, 10) || 0;
  return isNegative ? -parsed : parsed;
}

export function parseAdjustments(desc: string | null | undefined, amount: number | string) {
  const amt = Number(amount);
  if (!desc || amt === 0) return [];
  try {
    if (desc.trim().startsWith('[')) {
      const parsed = JSON.parse(desc);
      if (Array.isArray(parsed)) {
        return parsed.map((adj, index) => ({
          product_id: `ADJ-${index}-${Date.now()}`,
          product_kode: 'ADJ',
          product_nama: adj.desc || 'Penyesuaian',
          qty: 1,
          unit_price: Number(adj.amount),
          total: Number(adj.amount),
          is_adjustment: true,
        }));
      }
    }
  } catch (e) {
    console.error("Failed to parse adjustments:", e);
  }
  return [{
    product_id: 'ADJ-initial',
    product_kode: 'ADJ',
    product_nama: desc,
    qty: 1,
    unit_price: amt,
    total: amt,
    is_adjustment: true,
  }];
}

export function formatExtraChargeDesc(desc: string | null | undefined): string {
  if (!desc) return '';
  if (desc.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(desc);
      if (Array.isArray(parsed)) {
        return parsed.map(adj => `${adj.desc} (${formatCurrency(adj.amount)})`).join(', ');
      }
    } catch (e) {
      console.error(e);
    }
  }
  return desc;
}

