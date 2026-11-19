import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { useAllTransactions, useInvalidate } from '@/lib/data';
import { accountingEligible } from '@/lib/outside-accounting';
import { changeAccounting } from '@/lib/outside-accounting.functions';
import type { Tx } from '@/lib/finance';
import type { Provision } from '@/lib/provisions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export function AccountingAction({ rows, provisions, bulk = false }: { rows: Tx[]; provisions: Provision[]; bulk?: boolean }) {
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState('Empresa');
  const [note, setNote] = useState('');
  const [forward, setForward] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: all = [] } = useAllTransactions();
  const saveFn = useServerFn(changeAccounting);
  const refresh = useInvalidate();
  const first = rows[0];
  const restore = !bulk && first?.responsavel === 'Felipe' && first.tipo === 'saida' && first.nao_contabilizar;
  const eligible = rows.filter(t => restore ? t.responsavel === 'Felipe' && t.tipo === 'saida' && t.nao_contabilizar : accountingEligible(t));
  if (!bulk && !eligible.length) return null;
  const targets = all.filter(t => eligible.some(r => t.id === r.id || (forward && r.grupo_id && r.recorrencia !== 'unica' && t.grupo_id === r.grupo_id && t.data_vencimento >= r.data_vencimento)));
  const removesProvision = !restore && provisions.some(p => p.status === 'provisionado' && targets.some(t => t.id === p.transaction_id));
  const undoesReceipt = restore && targets.some(t => t.recebido);
  const recurring = eligible.some(t => t.recorrencia !== 'unica' && t.grupo_id);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await saveFn({ data: { ids: rows.map(t => t.id), excluded: !restore, person, note, forward } });
      await refresh(); toast.success(`${r.alterados} lançamento(s) atualizado(s) · ${r.ignorados} ignorado(s)`); setOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar.'); } finally { setBusy(false); }
  };
  return <>
    <Button size="sm" variant="outline" className="h-auto min-h-8 whitespace-normal px-2 py-1 text-xs" onClick={() => { setPerson('Empresa'); setNote(''); setForward(false); setOpen(true); }}>{bulk ? 'Não contabilizar selecionados' : restore ? 'Contabilizar novamente' : 'Não contabilizar'}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>{restore ? 'Contabilizar novamente' : 'Não contabilizar'}</DialogTitle><DialogDescription>{restore ? 'O valor voltará às suas contas e os dados de reembolso serão limpos.' : `${eligible.length} elegível(is) · ${rows.length - eligible.length} ignorado(s). Apenas saídas contabilizadas do Felipe serão alteradas.`}</DialogDescription></DialogHeader>
      <form onSubmit={save} className="space-y-4">
        {!restore && <><div><Label htmlFor="accounting-person">Quem vai reembolsar</Label><Input id="accounting-person" required maxLength={200} list="reimbursement-people" value={person} onChange={e => setPerson(e.target.value)} /><datalist id="reimbursement-people">{[...new Set(['Empresa', ...all.map(t => t.reembolso_de).filter((p): p is string => Boolean(p))])].map(p => <option key={p} value={p} />)}</datalist></div><div><Label htmlFor="accounting-note">Observação opcional</Label><Input id="accounting-note" maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></div></>}
        {recurring && <fieldset className="space-y-2 text-sm"><legend className="mb-2 font-semibold">Aplicar a:</legend><label className="flex gap-2"><input type="radio" checked={!forward} onChange={() => setForward(false)} />Só este mês</label><label className="flex gap-2"><input type="radio" checked={forward} onChange={() => setForward(true)} />Este e os próximos</label></fieldset>}
        {removesProvision && <p role="alert" className="text-sm text-warning-foreground">A provisão ativa será removida. O lançamento não será pago.</p>}
        {undoesReceipt && <p role="alert" className="text-sm text-warning-foreground">O recebimento já registrado será desfeito.</p>}
        <Button type="submit" disabled={busy || !eligible.length} className="w-full">{busy ? 'Salvando…' : restore ? 'Confirmar contabilização' : 'Confirmar não contabilizar'}</Button>
      </form>
    </DialogContent></Dialog>
  </>;
}
export function ReimbursementBadge({ tx }: { tx: Tx }) {
  if (!tx.nao_contabilizar || tx.responsavel !== 'Felipe') return null;
  return <span className={tx.recebido ? 'text-income' : 'text-warning-foreground'}>{tx.recebido ? 'Recebido' : `A receber · ${tx.reembolso_de || 'Não informado'}`}</span>;
}
