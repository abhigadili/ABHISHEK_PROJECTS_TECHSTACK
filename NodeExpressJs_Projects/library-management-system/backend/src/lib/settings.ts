import { Conn, query } from './db';

export interface Settings {
  library_name: string; library_address: string; library_phone: string; library_email: string;
  library_hours: string; library_about: string; currency_symbol: string;
  registration_requires_approval: boolean; default_member_type_id: number;
  block_borrowing_if_overdue: boolean; max_outstanding_balance: number;
  lost_book_default_charge: number; lost_book_processing_fee: number; damage_default_charge: number;
  reservation_hold_days: number; due_soon_days: number; review_moderation: boolean;
}

/** Reads policy straight from MySQL on every call (tiny table) so edits apply immediately. */
export async function getSettings(conn?: Conn): Promise<Settings> {
  const rows = await query<{ setting_key: string; value: string; value_type: string }>(
    'SELECT setting_key, value, value_type FROM library_settings', [], conn);
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    out[r.setting_key] = r.value_type === 'number' ? Number(r.value)
      : r.value_type === 'boolean' ? r.value === 'true' : r.value;
  }
  return out as unknown as Settings;
}
