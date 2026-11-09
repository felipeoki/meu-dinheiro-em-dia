import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { investmentSchema, type Investment } from './investments';

export const atualizarCdi = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ force: z.boolean().default(false) }))
  .handler(async ({ data }) => {
    const { refreshCdi } = await import('./cdi.server');
    return refreshCdi(data.force);
  });
export const listInvestments = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<Investment[]> => {
  const { data, error } = await context.supabase.from('investments').select('*').order('created_at').order('id');
  if (error) throw new Error('Não foi possível carregar os investimentos.');
  return data.map(v => ({ ...investmentSchema.parse({ ...v, valor_inicial: Number(v.valor_inicial), aporte_mensal: Number(v.aporte_mensal), taxa_anual: v.taxa_anual === null ? null : Number(v.taxa_anual), percentual_cdi: v.percentual_cdi === null ? null : Number(v.percentual_cdi) }), id: v.id }));
});
export const saveInvestment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid().nullable(), investment: investmentSchema }))
  .handler(async ({ data, context }) => {
    const row = { ...data.investment, user_id: context.userId };
    const result = data.id ? await context.supabase.from('investments').update(row).eq('id', data.id).select('id').single() : await context.supabase.from('investments').insert(row).select('id').single();
    if (result.error) throw new Error('Não foi possível salvar o investimento.');
    return result.data;
  });
export const removeInvestment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('investments').delete().eq('id', data.id);
    if (error) throw new Error('Não foi possível excluir o investimento.');
    return { success: true };
  });