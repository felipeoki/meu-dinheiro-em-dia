import { cdiIsStale, parseBcbRate, type CdiRate, type CdiState } from './investments';

export async function refreshCdi(force = false): Promise<CdiState> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const latest = await supabaseAdmin.from('cdi_rates').select('*').order('referencia', { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw new Error('Não foi possível consultar o CDI.');
  const saved: CdiRate | null = latest.data ? { ...latest.data, taxa_anual: Number(latest.data.taxa_anual) } : null;
  if (!force && !cdiIsStale(saved)) return { rate: saved, failed: false };
  for (const series of [4389, 432]) {
    try {
      const response = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/1?formato=json`, { signal: AbortSignal.timeout(7000) });
      if (!response.ok) continue;
      const rate = parseBcbRate(await response.json(), series === 432);
      if (!rate || (saved && rate.referencia < saved.referencia)) continue;
      const updated = await supabaseAdmin.from('cdi_rates').upsert({ ...rate, atualizado_em: new Date().toISOString() }, { onConflict: 'referencia' }).select('*').single();
      if (updated.error) continue;
      return { rate: { ...updated.data, taxa_anual: Number(updated.data.taxa_anual) }, failed: false };
    } catch { /* Retain last valid rate, then try the documented fallback. */ }
  }
  return { rate: saved, failed: true };
}