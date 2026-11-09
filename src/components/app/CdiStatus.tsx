import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { cdiQuery } from '@/lib/investments.queries';
import { atualizarCdi } from '@/lib/investments.functions';
import { fmtDate } from '@/lib/finance';
import { Button } from '@/components/ui/button';

export function CdiStatus() {
  const query = useQuery(cdiQuery), qc = useQueryClient(), refresh = useServerFn(atualizarCdi);
  const [busy, setBusy] = useState(false);
  const rate = query.data?.rate;
  return <div className="mb-5 flex items-start justify-between gap-3 border-y py-3"><div><p className="text-sm font-semibold">{rate ? `CDI hoje: ${rate.taxa_anual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a. · atualizado em ${fmtDate(rate.atualizado_em.slice(0, 10))}` : query.isPending ? 'Consultando CDI…' : 'CDI indisponível'}</p>{rate && <p className="mt-1 text-xs text-muted-foreground">Referência {fmtDate(rate.referencia)} · {rate.fonte}</p>}{(query.data?.failed || query.isError) && <p role="status" className="mt-1 text-xs text-warning-foreground">Atualização indisponível.{rate ? ' Exibindo o último CDI conhecido.' : ' Simulações CDI aguardam uma taxa válida.'}</p>}</div><Button variant="ghost" size="icon" title="Atualizar CDI" aria-label="Atualizar CDI" disabled={busy} onClick={async () => { setBusy(true); try { const data = await refresh({ data: { force: true } }); qc.setQueryData(cdiQuery.queryKey, data); } catch { qc.setQueryData(cdiQuery.queryKey, { rate: rate ?? null, failed: true }); } finally { setBusy(false); } }}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} /></Button></div>;
}