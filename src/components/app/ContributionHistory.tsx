import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { contributionTargets, type Contribution } from '@/lib/contributions';
import { removeContribution } from '@/lib/contributions.functions';
import { fmtBRL, fmtDate, monthShort } from '@/lib/finance';
import type { Investment } from '@/lib/investments';
import { ContributionForm } from './ContributionForm';

export function ContributionHistory({ investment, contributions, cdi, today }: { investment: Investment; contributions: Contribution[]; cdi: number | null; today: string }) {
  const [editing, setEditing] = useState<Contribution | null>(null);
  const remove = useServerFn(removeContribution), qc = useQueryClient();
  const mutation = useMutation({ mutationFn: remove, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['investment-contributions'] }); toast.success('Aporte excluído'); }, onError: () => toast.error('Não foi possível excluir o aporte.') });
  let accumulated = 0;
  const history = [...contributions].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id)).map(c => { accumulated += c.valor; return { ...c, accumulated }; }).reverse();
  const targets = contributionTargets(investment, contributions, today);
  return <><section className="mt-6"><h2 className="mb-3 font-semibold">Histórico de aportes</h2>{history.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum aporte registrado.</p> : <div className="divide-y border-y">{history.map(c => <div key={c.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm">{fmtDate(c.data)} · <strong>{fmtBRL(c.valor)}</strong></p>{c.observacao && <p className="break-words text-sm text-muted-foreground">{c.observacao}</p>}<p className="text-xs text-muted-foreground">Acumulado: {fmtBRL(c.accumulated)}</p></div><Button size="icon" variant="ghost" aria-label={`Editar aporte ${fmtDate(c.data)}`} title="Editar aporte" onClick={() => setEditing(c)}><Pencil /></Button><Button size="icon" variant="ghost" disabled={mutation.isPending} aria-label={`Excluir aporte ${fmtDate(c.data)}`} title="Excluir aporte" onClick={() => { if (confirm('Excluir este aporte? O saldo será recalculado.')) mutation.mutate({ data: { id: c.id } }); }}><Trash2 /></Button></div>)}</div>}</section><section className="mt-6"><h2 className="mb-3 font-semibold">Meta × realizado por mês</h2><div className="max-h-96 overflow-auto border-y"><table className="w-full min-w-96 text-sm tabular"><thead className="sticky top-0 bg-card"><tr>{['Mês', 'Planejado', 'Realizado', 'Diferença'].map(label => <th key={label} className="p-3 text-right first:text-left">{label}</th>)}</tr></thead><tbody>{targets.map(t => <tr key={t.mes} className="border-t"><td className="p-3">{monthShort(t.mes)}</td><td className="p-3 text-right">{fmtBRL(t.meta)}</td><td className="p-3 text-right">{fmtBRL(t.realizado)}</td><td className={`p-3 text-right ${t.diferenca >= 0 ? 'text-income' : 'text-expense'}`}>{fmtBRL(t.diferenca)}</td></tr>)}</tbody></table></div></section>{editing && <ContributionForm investment={investment} contribution={editing} cdi={cdi} close={() => setEditing(null)} />}</>;
}