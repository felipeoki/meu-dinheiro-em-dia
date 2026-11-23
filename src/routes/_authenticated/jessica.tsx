import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { useAccounts, useAllTransactions, useInvalidate, useMonth } from '@/lib/data';
import { fmtBRL, fmtDate, inMonth, monthLabel, parcelaLabel, sum, type Tx } from '@/lib/finance';
import { jessicaUpcoming, outsideSummary, saoPauloToday, validateReceiptDate } from '@/lib/outside-accounting';
import { receiveJessica } from '@/lib/outside-accounting.functions';
import { openTx } from '@/components/app/TxForm';
import { Loading, MonthSelector, PageHeader, Stat } from '@/components/app/ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReceiptPdfButton } from '@/components/app/ReceiptPdfButton';
export const Route = createFileRoute('/_authenticated/jessica')({
  head: () => ({ meta: [{ title: 'Jéssica — Finanças Pessoais' }, { name: 'description', content: 'Contas e recebimentos da Jéssica por mês e cartão.' }, { property: 'og:title', content: 'Jéssica — Finanças Pessoais' }, { property: 'og:description', content: 'Contas e recebimentos da Jéssica por mês e cartão.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Jessica,
});
function Jessica() { const month = useMonth(); return <JessicaMonth key={month} month={month} />; }
function JessicaMonth({ month }: { month: string }) {
  const { data: all = [], isLoading, isError } = useAllTransactions();
  const { data: accounts = [] } = useAccounts();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [receiving, setReceiving] = useState<Tx[]>([]);
  const [date, setDate] = useState(saoPauloToday());
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(receiveJessica);
  const refresh = useInvalidate();
  const hers = all.filter(t => t.responsavel === 'Jéssica');
  const rows = hers.filter(t => inMonth(t, month)).sort((a,b) => a.data_vencimento.localeCompare(b.data_vencimento) || a.descricao.localeCompare(b.descricao,'pt-BR'));
  const summary = outsideSummary(hers, month);
  const pending = rows.filter(t => !t.recebido);
  const selectedRows = pending.filter(t => selected.has(t.id));
  const groups = [...new Set(rows.map(t => t.conta_id))];
  const begin = (items: Tx[]) => { setDate(saoPauloToday()); setReceiving(items); };
  const undo = async (t: Tx) => {
    if (!confirm(`Desfazer o recebimento de “${t.descricao}”?`)) return;
    setBusy(true);
    try { await fn({ data: { ids: [t.id], received: false, date: '' } }); await refresh(); toast.success('Recebimento desfeito'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível desfazer.'); } finally { setBusy(false); }
  };
  const receive = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { validateReceiptDate(date, saoPauloToday()); const count = await fn({ data: { ids: receiving.map(t => t.id), received: true, date } }); await refresh(); setReceiving([]); setSelected(new Set()); toast.success(`${count} recebimento(s) registrado(s)`); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível registrar.'); } finally { setBusy(false); }
  };
  return <div className={selectedRows.length ? 'pb-40' : ''}>
    <PageHeader title="Jéssica"><div className="flex flex-wrap items-center gap-2"><ReceiptPdfButton month={month} kind="jessica" /><MonthSelector /></div></PageHeader>
    <Button className="mb-4" onClick={() => openTx({ defaults: { responsavel: 'Jéssica' } })}>Adicionar conta da Jéssica</Button>
    {isLoading ? <Loading /> : isError ? <p role="alert">Não foi possível carregar as contas da Jéssica.</p> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="A receber da Jéssica" value={<span className="text-warning-foreground">{fmtBRL(summary.pendente)}</span>} /><Stat label="Já recebido" tone="income" value={fmtBRL(summary.recebido)} /><Stat label="Total do mês" value={fmtBRL(summary.total)} /><Stat label="Pendente acumulado (todos os meses)" value={fmtBRL(summary.acumulado)} /></div>
      <label className="my-4 flex items-center gap-2 text-sm"><Checkbox aria-label="Selecionar todos" checked={pending.length > 0 && selectedRows.length === pending.length ? true : selectedRows.length ? 'indeterminate' : false} onCheckedChange={v => setSelected(v === true ? new Set(pending.map(t => t.id)) : new Set())} />Selecionar todos · {rows.length} itens</label>
      {!rows.length && <p className="my-6 text-muted-foreground">Nenhuma conta neste mês.</p>}
      {groups.map(id => { const items = rows.filter(t => t.conta_id === id); return <section key={id ?? 'none'} className="mb-6"><h2 className="mb-2 flex flex-wrap justify-between gap-2 font-semibold"><span>{accounts.find(a => a.id === id)?.nome ?? 'Sem conta'}</span><span className="tabular">{fmtBRL(sum(items))}</span></h2><div className="divide-y border-y">{items.map(t => <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto_1.5rem] items-center gap-2 py-3">
        <div className="min-w-0"><Button variant="ghost" className="h-auto justify-start whitespace-normal p-0 text-left" onClick={() => openTx({ tx:t })}>{t.descricao || 'Sem descrição'}</Button><p className="text-xs text-muted-foreground">{fmtDate(t.data_vencimento)} · {t.recorrencia === 'unica' ? 'Único' : parcelaLabel(t)}</p><p className={t.recebido ? 'text-xs text-income' : 'text-xs text-warning-foreground'}>{t.recebido ? `Recebido ${fmtDate(t.recebido_em)}` : 'A receber'}</p></div>
        <strong className="tabular text-sm">{fmtBRL(t.valor)}</strong><Checkbox aria-label={`Selecionar ${t.descricao}`} disabled={t.recebido} checked={selected.has(t.id) && !t.recebido} onCheckedChange={v => setSelected(old => { const next = new Set(old); if (v === true) next.add(t.id); else next.delete(t.id); return next; })} />
        <Button size="sm" variant="outline" className="col-span-2 w-fit" disabled={busy} onClick={() => t.recebido ? undo(t) : begin([t])}>{t.recebido ? 'Desfazer' : 'Marcar como recebido'}</Button>
      </div>)}</div></section>; })}
      <section className="mt-8"><h2 className="mb-3 font-semibold">Próximos meses</h2><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Mês</th><th className="text-right">Total</th></tr></thead><tbody>{jessicaUpcoming(hers,month).map(r => <tr key={r.mes} className="border-b"><td className="py-2">{monthLabel(r.mes)}</td><td className="tabular text-right">{fmtBRL(r.total)}</td></tr>)}</tbody></table></section>
    </>}
    {selectedRows.length > 0 && <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap justify-between gap-2 border-t bg-card p-3 md:bottom-0 md:left-60"><Button className="h-auto whitespace-normal" disabled={busy} onClick={() => begin(selectedRows)}>Receber selecionados ({selectedRows.length}) · {fmtBRL(sum(selectedRows))}</Button><Button variant="outline" onClick={() => setSelected(new Set())}>Limpar seleção</Button></div>}
    <Dialog open={receiving.length > 0} onOpenChange={v => !v && setReceiving([])}><DialogContent><DialogHeader><DialogTitle>Receber da Jéssica</DialogTitle></DialogHeader><p>{receiving.length} item(ns) · {fmtBRL(sum(receiving))}</p><form onSubmit={receive} className="space-y-4"><div><Label htmlFor="jessica-date">Data do recebimento</Label><Input id="jessica-date" type="date" required max={saoPauloToday()} value={date} onChange={e => setDate(e.target.value)} /></div><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Confirmar recebimento'}</Button></form></DialogContent></Dialog>
  </div>;
}
