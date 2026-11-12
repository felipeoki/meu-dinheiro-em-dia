import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import type { Tx } from '@/lib/finance';
import { parseValor, fmtBRL } from '@/lib/finance';
import type { Provision } from '@/lib/provisions';
import { provisionEligible } from '@/lib/provisions';
import { removeProvision, sendProvisions } from '@/lib/provisions.functions';
import { useProvisionRefresh } from '@/lib/provisions.queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ProvisionAction({ tx, provision }: { tx: Tx; provision: Provision | undefined }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(tx.valor).replace('.', ','));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = useServerFn(sendProvisions);
  const remove = useServerFn(removeProvision);
  const refresh = useProvisionRefresh();
  if (!provisionEligible(tx)) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseValor(value);
    if (!Number.isFinite(valor) || valor <= 0) { toast.error('Informe um valor positivo.'); return; }
    setBusy(true);
    try {
      const result = await send({ data: { items: [{ transaction_id: tx.id, valor, observacao: note }] } });
      await refresh();
      toast.success(result.enviados ? 'Enviado para provisionamento' : 'Este lançamento já está provisionado ou não é mais elegível.');
      setOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível provisionar.'); }
    finally { setBusy(false); }
  };
  const removeItem = async () => {
    if (!provision || !confirm(`Remover "${tx.descricao}" do provisionamento? O lançamento continuará pendente.`)) return;
    setBusy(true);
    try { await remove({ data: { id: provision.id } }); await refresh(); toast.success('Removido do provisionamento'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível remover.'); }
    finally { setBusy(false); }
  };
  return <>
    <Button size="sm" variant="outline" disabled={busy} className="h-auto min-h-8 w-full whitespace-normal px-2 py-1 text-xs" onClick={provision ? removeItem : () => { setValue(String(tx.valor).replace('.', ',')); setOpen(true); }}>
      {provision ? 'Remover do provisionamento' : 'Enviar para provisionamento'}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>Enviar para provisionamento</DialogTitle></DialogHeader>
      <p className="text-sm font-medium">{tx.descricao || 'Sem descrição'} · {fmtBRL(tx.valor)}</p>
      <form onSubmit={save} className="space-y-4">
        <div><Label htmlFor={`provision-value-${tx.id}`}>Valor a provisionar (R$)</Label><Input id={`provision-value-${tx.id}`} required inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} /></div>
        <div><Label htmlFor={`provision-note-${tx.id}`}>Observação opcional</Label><Input id={`provision-note-${tx.id}`} maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? 'Enviando…' : 'Confirmar provisionamento'}</Button>
      </form>
    </DialogContent></Dialog>
  </>;
}

export function BulkProvisionAction({ rows }: { rows: Tx[] }) {
  const send = useServerFn(sendProvisions);
  const refresh = useProvisionRefresh();
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const result = await send({ data: { items: rows.map(t => ({ transaction_id: t.id, valor: t.valor })) } });
      await refresh();
      toast.success(`${result.enviados} enviado(s) para provisionamento · ${result.ignorados} ignorado(s)`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível provisionar.'); }
    finally { setBusy(false); }
  };
  return <Button variant="outline" size="sm" disabled={busy} className="h-auto min-h-9 whitespace-normal" onClick={save}>Enviar selecionados para provisionamento</Button>;
}