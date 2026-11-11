import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { contributionSchema, saoPauloToday, validateContribution, type Contribution } from './contributions';

export const listContributions = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<Contribution[]> => {
  const all: Contribution[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await context.supabase.from('investment_contributions').select('*').order('data', { ascending: false }).order('id').range(page * 1000, page * 1000 + 999);
    if (error) throw new Error('Não foi possível carregar os aportes.');
    all.push(...data.map(c => ({ ...c, valor: Number(c.valor) })));
    if (data.length < 1000) break;
  }
  return all;
});
export const saveContribution = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid().nullable(), contribution: contributionSchema }))
  .handler(async ({ data, context }) => {
    const { data: investment, error } = await context.supabase.from('investments').select('data_inicio').eq('id', data.contribution.investment_id).single();
    if (error || !investment) throw new Error('Investimento não encontrado.');
    const validation = validateContribution(data.contribution, investment.data_inicio, saoPauloToday());
    if (validation) throw new Error(validation);
    const row = { ...data.contribution, user_id: context.userId };
    const result = data.id ? await context.supabase.from('investment_contributions').update(row).eq('id', data.id).select('id').single() : await context.supabase.from('investment_contributions').insert(row).select('id').single();
    if (result.error) throw new Error('Não foi possível salvar o aporte.');
    return result.data;
  });
export const removeContribution = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from('investment_contributions').delete().eq('id', data.id);
  if (error) throw new Error('Não foi possível excluir o aporte.');
  return { success: true };
});