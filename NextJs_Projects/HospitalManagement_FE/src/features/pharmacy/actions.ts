'use server';
import { revalidatePath } from 'next/cache';
import { pharmacyService } from '@/server/services/pharmacy.service';
import { run } from '@/server/http/action';
const bust = () => { for (const p of ['/pharmacy', '/pharmacy/inventory', '/pharmacy/queue', '/pharmacy/history', '/pharmacy/expiry', '/pharmacy/medicines']) revalidatePath(p); };
export async function createMedicineAction(values: unknown) { const r = await run((p) => pharmacyService.createMedicine(p, values), 'Medicine added'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function receiveStockAction(values: unknown) { const r = await run((p) => pharmacyService.receiveStock(p, values), 'Stock received'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function adjustStockAction(id: number, values: unknown) { const r = await run((p) => pharmacyService.adjustStock(p, id, values), 'Stock adjusted'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function dispenseAction(prescriptionId: number, values: unknown) { const r = await run((p) => pharmacyService.dispense(p, prescriptionId, values), 'Medicines dispensed'); if (r.ok) { bust(); revalidatePath('/billing/invoices'); } return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
