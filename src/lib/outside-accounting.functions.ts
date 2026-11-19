import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { saoPauloToday, validateReceiptDate } from './outside-accounting';
export const changeAccounting = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).min(1), excluded: z.boolean(), person: z.string().max(200), note: z.string().max(200), forward: z.boolean() }))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc('set_transaction_accounting', { p_ids: data.ids, p_excluded: data.excluded, p_person: data.person, p_note: data.note, p_forward: data.forward });
    if (r.error) throw new Error(r.error.message);
    return z.object({ alterados: z.number(), ignorados: z.number() }).parse(r.data);
  });
export const receiveJessica = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).min(1), received: z.boolean(), date: z.string() }))
  .handler(async ({ data, context }) => {
    if (data.received) validateReceiptDate(data.date, saoPauloToday());
    const r = await context.supabase.rpc('receive_jessica_transactions', { p_ids: data.ids, p_received: data.received, ...(data.received ? { p_date: data.date } : {}) });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
