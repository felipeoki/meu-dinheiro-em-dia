import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Archive, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { investmentsQuery, cdiQuery, contributionsQuery } from '@/lib/investments.queries';
import { effectiveRate, type Investment } from '@/lib/investments';
import { removeInvestment, saveInvestment } from '@/lib/investments.functions';
import { fmtBRL } from '@/lib/finance';
import { PageHeader, Stat } from '@/components/app/ui';
import { Button } from '@/components/ui/button';
import { InvestmentForm } from '@/components/app/InvestmentForm';
import { saoPauloToday, simulateWithContributions } from '@/lib/contributions';
import { ContributionForm } from '@/components/app/ContributionForm';
import { CdiStatus } from '@/components/app/CdiStatus';

export const Route = createFileRoute('/_authenticated/investimentos/')({
  head: () => ({ meta: [{ title: 'Investimentos — Finanças Pessoais' }, { name: 'description', content: 'Investimentos, CDI atualizado e patrimônio projetado.' }, { property: 'og:title', content: 'Investimentos — Finanças Pessoais' }, { property: 'og:description', content: 'Investimentos, CDI atualizado e patrimônio projetado.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(investmentsQuery), context.queryClient.ensureQueryData(contributionsQuery)]); },
  component: Investments,
});
function Investments() {
  const { data: investments } = useSuspenseQuery(investmentsQuery), { data: cdi } = useQuery(cdiQuery);
  const { data: contributions } = useSuspenseQuery(contributionsQuery);
  const [registering, setRegistering] = useState<Investment | null>(null);
  const [editor, setEditor] = useState<{ investment: Investment | null } | null>(null), [archived, setArchived] = useState(false);
  const remove = useServerFn(removeInvestment), save = useServerFn(saveInvestment), qc = useQueryClient();
  const today = saoPauloToday(), current = today.slice(0, 7);
  const rows = investments.map(v => {
    const annual = effectiveRate(v, cdi?.rate?.taxa_anual ?? null);
    const months = annual === null ? null : simulateWithContributions(v, annual, v.horizonte_anos, contributions.filter(c => c.investment_id === v.id), today);
    const now = months?.find(m => m.mes === current)?.saldo ?? (current < v.data_inicio.slice(0, 7) ? 0 : months?.at(-1)?.saldo ?? null);
    return { v, annual, months, now };
  });
  const active = rows.filter(r => r.v.ativo), missing = active.some(r => r.annual === null);
  const action = async (fn: () => Promise<unknown>) => { try { await fn(); await Promise.all([qc.invalidateQueries({ queryKey: ['investments'] }), qc.invalidateQueries({ queryKey: ['investment-contributions'] })]); } catch { toast.error('Não foi possível alterar o investimento.'); } };
  return <><PageHeader title="Investimentos"><Button onClick={() => setEditor({ investment: null })}><Plus className="h-4 w-4" />Novo investimento</Button></PageHeader><CdiStatus />
    <div className="mb-6 grid gap-3 sm:grid-cols-2"><Stat label="Patrimônio projetado no mês atual" value={missing ? 'CDI indisponível' : fmtBRL(active.reduce((a, r) => a + (r.now ?? 0), 0))} /><Stat label="Consolidado no fim dos horizontes" value={missing ? 'CDI indisponível' : fmtBRL(active.reduce((a, r) => a + (r.months?.at(-1)?.saldo ?? 0), 0))} sub="Soma dos horizontes individuais" /></div>
    <div className="mb-4 flex gap-2"><Button variant={!archived ? 'default' : 'outline'} onClick={() => setArchived(false)}>Ativos</Button><Button variant={archived ? 'default' : 'outline'} onClick={() => setArchived(true)}>Arquivados</Button></div>
    <div className="grid gap-4 sm:grid-cols-2">{rows.filter(r => r.v.ativo !== archived).map(({ v, annual, months, now }) => <article key={v.id} className="rounded-lg border bg-card p-4"><div className="mb-4 flex items-center gap-3"><TrendingUp className={`h-5 w-5 ${ { primary: 'text-primary', 'chart-2': 'text-chart-2', 'chart-4': 'text-chart-4', 'chart-5': 'text-chart-5' }[v.cor] }`} /><Link to="/investimentos/$id" params={{ id: v.id }} className="min-w-0 flex-1 break-words font-display text-lg font-bold">{v.nome}</Link><span className="shrink-0 rounded border px-2 py-1 text-xs text-muted-foreground">{v.tipo_taxa === 'cdi' ? `CDI ${v.percentual_cdi}%` : `${v.taxa_anual}% a.a.`}</span></div><p className="text-xs text-muted-foreground">Saldo projetado · mês atual</p><p className="tabular mt-1 text-2xl font-bold">{now === null ? 'Aguardando CDI' : fmtBRL(now)}</p><dl className="my-4 space-y-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Fim do horizonte · {v.horizonte_anos} anos</dt><dd className="tabular font-semibold">{months ? fmtBRL(months.at(-1)?.saldo ?? 0) : '—'}</dd></div><div className="flex justify-between gap-2"><dt className="text-muted-foreground">Taxa efetiva atual</dt><dd>{annual === null ? '—' : `${annual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}% a.a.`}</dd></div></dl><Button className="mb-3" variant="outline" onClick={() => setRegistering(v)}>Registrar aporte</Button><div className="flex items-center gap-1 border-t pt-3"><Button variant="outline" asChild><Link to="/investimentos/$id" params={{ id: v.id }}>Ver projeção</Link></Button><div className="flex-1" /><Button size="icon" variant="ghost" aria-label={`Editar ${v.nome}`} title="Editar" onClick={() => setEditor({ investment: v })}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`${v.ativo ? 'Arquivar' : 'Reativar'} ${v.nome}`} title={v.ativo ? 'Arquivar' : 'Reativar'} onClick={() => { if (confirm(`${v.ativo ? 'Arquivar' : 'Reativar'} "${v.nome}"?`)) void action(() => save({ data: { id: v.id, investment: { ...v, ativo: !v.ativo } } })); }}><Archive className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Excluir ${v.nome}`} title="Excluir" onClick={() => { if (confirm(`Excluir definitivamente "${v.nome}"?`)) void action(() => remove({ data: { id: v.id } })); }}><Trash2 className="h-4 w-4" /></Button></div></article>)}</div>
    {rows.filter(r => r.v.ativo !== archived).length === 0 && <p className="py-12 text-center text-muted-foreground">{archived ? 'Nenhum investimento arquivado.' : 'Nenhum investimento cadastrado.'}</p>}
    {registering && <ContributionForm investment={registering} contribution={null} cdi={cdi?.rate?.taxa_anual ?? null} close={() => setRegistering(null)} />}
    {editor && <InvestmentForm investment={editor.investment} close={() => setEditor(null)} />}
  </>;
}