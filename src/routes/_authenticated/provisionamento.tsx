import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { fmtBRL, fmtDate, parseValor } from '@/lib/finance';
import { saoPauloToday } from '@/lib/contributions';
import { activeProvisionCents, provisionCents, validPaymentDate, type Provision } from '@/lib/provisions';
import { provisionsQuery, useProvisionRefresh } from '@/lib/provisions.queries';
import { payProvisions, removeProvision, undoProvision } from '@/lib/provisions.functions';
import { useAccounts, useCategories } from '@/lib/data';
import { CatBadge, PageHeader, Stat } from '@/components/app/ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const Route = createFileRoute('/_authenticated/provisionamento')({
  head: () => ({ meta: [
    { title: 'Provisionamento — Finanças Pessoais' },
    { name: 'description', content: 'Valores separados para contas futuras e histórico de pagamentos.' },
    { property: 'og:title', content: 'Provisionamento — Finanças Pessoais' },
    { property: 'og:description', content: 'Valores separados para contas futuras e histórico de pagamentos.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(provisionsQuery),
  component: Provisionamento,
});

function Provisionamento() {
  const { data: rows } = useSuspenseQuery(provisionsQuery);
  const { data: cats = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const [tab, setTab] = useState<'ativas' | 'pagos'>('ativas');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paymentRows, setPaymentRows] = useState<Provision[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(saoPauloToday());
  const [busy, setBusy] = useState(false);
  const pay = useServerFn(payProvisions);
  const remove = useServerFn(removeProvision);
  const undo = useServerFn(undoProvision);
  const refresh = useProvisionRefresh();
  const active = rows.filter(p => p.status === 'provisionado');
  const paid = rows.filter(p => p.status === 'pago').sort((a,b) => (b.pago_em ?? '').localeCompare(a.pago_em ?? '') || a.id.localeCompare(b.id));
  const chosen = active.filter(p => selected.has(p.id));
  const choose = (id: string, checked: boolean) => setSelected(prev => { const next = new Set(prev); if (checked) next.add(id); else next.delete(id); return next; });
  const startPayment = () => {
    setDate(saoPauloToday());
    setPaymentRows(chosen);
    setValues(Object.fromEntries(chosen.map(p => [p.id, String(p.valor_provisionado).replace('.', ',')])));
  };
  const confirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validPaymentDate(date, saoPauloToday())) { toast.error('A data do pagamento não pode ser futura.'); return; }
    const items = paymentRows.map(p => ({ id: p.id, valor: parseValor(values[p.id]) }));
    if (items.some(p => !Number.isFinite(p.valor) || p.valor <= 0)) { toast.error('Informe um valor pago positivo para cada item.'); return; }
    setBusy(true);
    try {
      await pay({ data: { date, items } });
      await refresh();
      setSelected(new Set()); setPaymentRows([]);
      toast.success('Pagamentos confirmados e total a separar atualizado');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível pagar.'); }
    finally { setBusy(false); }
  };
  const removeItem = async (p: Provision) => {
    if (!confirm(`Remover "${p.transaction.descricao}" do provisionamento? O lançamento continuará pendente.`)) return;
    setBusy(true);
    try { await remove({ data: { id: p.id } }); await refresh(); choose(p.id, false); toast.success('Removido do provisionamento'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível remover.'); }
    finally { setBusy(false); }
  };
  const undoItem = async (p: Provision) => {
    if (!confirm(`Desfazer pagamento de "${p.transaction.descricao}"? O lançamento ficará pendente, mantendo o valor corrigido do boleto.`)) return;
    setBusy(true);
    try { await undo({ data: { id: p.id } }); await refresh(); toast.success('Pagamento desfeito; provisão ativa novamente'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível desfazer.'); }
    finally { setBusy(false); }
  };
  return <div className={chosen.length && tab === 'ativas' ? 'pb-40' : ''}>
    <PageHeader title="Provisionamento" />
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Stat label="Total a separar" value={fmtBRL(activeProvisionCents(rows) / 100)} />
      <Stat label="Itens provisionados" value={active.length} />
      <Stat label="Próximo vencimento" value={active[0] ? fmtDate(active[0].transaction.data_vencimento) : '—'} />
    </div>
    <div role="tablist" aria-label="Situação do provisionamento" className="mb-4 flex gap-2">
      <Button role="tab" aria-selected={tab === 'ativas'} variant={tab === 'ativas' ? 'default' : 'outline'} onClick={() => setTab('ativas')}>Ativas</Button>
      <Button role="tab" aria-selected={tab === 'pagos'} variant={tab === 'pagos' ? 'default' : 'outline'} onClick={() => setTab('pagos')}>Pagos</Button>
    </div>
    {tab === 'ativas' && active.length > 0 && <label className="mb-3 flex w-fit items-center gap-2 text-sm">
      <Checkbox aria-label="Selecionar todos" checked={chosen.length === active.length ? true : chosen.length ? 'indeterminate' : false} onCheckedChange={c => setSelected(c === true ? new Set(active.map(p => p.id)) : new Set())} />Selecionar todos
    </label>}
    {(tab === 'ativas' ? active : paid).length === 0 ? <p className="border-y py-12 text-center text-sm text-muted-foreground">{tab === 'ativas' ? 'Nenhum valor a separar.' : 'Nenhum pagamento no histórico.'}</p> : <div className="divide-y border-y">
      {(tab === 'ativas' ? active : paid).map(p => <section key={p.id} aria-label={p.transaction.descricao || 'Sem descrição'} className="flex flex-wrap items-center gap-3 py-3">
        {tab === 'ativas' && <Checkbox aria-label={`Selecionar pagamento: ${p.transaction.descricao}`} checked={selected.has(p.id)} onCheckedChange={c => choose(p.id, c === true)} />}
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold">{p.transaction.descricao || 'Sem descrição'}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2"><CatBadge cat={cats.find(c => c.id === p.transaction.categoria_id)} /><span className="text-xs text-muted-foreground">{accounts.find(a => a.id === p.transaction.conta_id)?.nome ?? 'Sem conta'} · Vence {fmtDate(p.transaction.data_vencimento)}</span></div>
          {p.observacao && <p className="mt-1 break-words text-xs text-muted-foreground">{p.observacao}</p>}
          {tab === 'pagos' && <p className="mt-1 text-xs">Pago em {fmtDate(p.pago_em)} · Valor pago: <strong>{fmtBRL(p.valor_pago ?? 0)}</strong></p>}
        </div>
        <div className="tabular text-right text-sm"><span className="block text-xs text-muted-foreground">Provisionado</span><strong>{fmtBRL(p.valor_provisionado)}</strong></div>
        <Button size="sm" variant="outline" disabled={busy} className="h-auto min-h-9 w-full whitespace-normal sm:w-auto" onClick={() => tab === 'ativas' ? removeItem(p) : undoItem(p)}>{tab === 'ativas' ? 'Remover do provisionamento' : 'Desfazer pagamento'}</Button>
      </section>)}
    </div>}
    {tab === 'ativas' && chosen.length > 0 && <section aria-label="Pagamento da seleção" className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t bg-card p-3 shadow-lg md:bottom-0 md:left-60">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <p className="tabular text-sm font-semibold" aria-live="polite">{chosen.length} selecionado{chosen.length === 1 ? '' : 's'} · {fmtBRL(provisionCents(chosen) / 100)}</p>
        <Button className="h-auto min-h-9 whitespace-normal" onClick={startPayment}>Pagar selecionados ({chosen.length}) · {fmtBRL(provisionCents(chosen) / 100)}</Button>
      </div>
    </section>}
    <Dialog open={paymentRows.length > 0} onOpenChange={o => { if (!o && !busy) setPaymentRows([]); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Pagar selecionados</DialogTitle></DialogHeader>
      <p className="border-l-2 border-warning bg-warning/10 p-3 text-sm">Se o valor pago for diferente, o valor do lançamento DESTE mês será atualizado para o valor pago. Os demais meses não serão alterados.</p>
      <form className="space-y-4" onSubmit={confirmPayment}>
        <div><Label htmlFor="payment-date">Data do pagamento</Label><Input id="payment-date" type="date" required max={saoPauloToday()} value={date} onChange={e => setDate(e.target.value)} /></div>
        {paymentRows.map(p => <div key={p.id}><Label htmlFor={`paid-value-${p.id}`}>Valor pago — {p.transaction.descricao || 'Sem descrição'} (R$)</Label><Input id={`paid-value-${p.id}`} required inputMode="decimal" value={values[p.id] ?? ''} onChange={e => setValues(prev => ({ ...prev, [p.id]: e.target.value }))} /></div>)}
        <Button type="submit" disabled={busy} className="w-full">{busy ? 'Confirmando…' : 'Confirmar pagamentos'}</Button>
      </form>
    </DialogContent></Dialog>
  </div>;
}