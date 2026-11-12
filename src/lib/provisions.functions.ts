import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { normTx } from './data';
import type { Provision } from './provisions';

export const listProvisions = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<Provision[]> => {
  const rows: Provision[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await context.supabase.from('provisions').select('*, transaction:transactions(*)').order('id').range(page * 1000, page * 1000 + 999);
    if (error) throw new Error('Não foi possível carregar o provisionamento.');
    for (const p of data) {
      if (!p.transaction) continue;
      rows.push({ ...p, status: p.status === 'pago' ? 'pago' : 'provisionado', valor_provisionado: Number(p.valor_provisionado), valor_pago: p.valor_pago == null ? null : Number(p.valor_pago), transaction: normTx(p.transaction) });
    }
    if (data.length < 1000) break;
  }
  return rows.sort((a, b) => a.transaction.data_vencimento.localeCompare(b.transaction.data_vencimento) || a.transaction.descricao.localeCompare(b.transaction.descricao, 'pt-BR') || a.id.localeCompare(b.id));
});
export const sendProvisions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ items: z.array(z.object({ transaction_id: z.string().uuid(), valor: z.number().finite().positive(), observacao: z.string().max(200).optional() })).min(1) }))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc('provision_transactions', { p_items: data.items });
    if (result.error) throw new Error(result.error.message);
    const parsed = z.object({ enviados: z.number(), ignorados: z.number() }).parse(result.data);
    return parsed;
  });
export const payProvisions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), items: z.array(z.object({ id: z.string().uuid(), valor: z.number().finite().positive() })).min(1) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('pay_provisions', { p_date: data.date, p_items: data.items });
    if (error) throw new Error(error.message);
    return { success: true };
  });
export const undoProvision = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('undo_provision_payment', { p_id: data.id });
  if (error) throw new Error(error.message);
  return { success: true };
});
export const removeProvision = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from('provisions').delete().eq('id', data.id).eq('status', 'provisionado');
  if (error) throw new Error(error.message);
  return { success: true };
});