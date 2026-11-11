import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveContribution } from '@/lib/contributions.functions';
import { saoPauloToday, simulateWithContributions, validateContribution, type Contribution, type ContributionInput } from '@/lib/contributions';
import { contributionsQuery } from '@/lib/investments.queries';
import { effectiveRate, type Investment } from '@/lib/investments';
import { fmtBRL, parseValor } from '@/lib/finance';

export function ContributionForm({ investment, contribution, cdi, close }: { investment: Investment; contribution: Contribution | null; cdi: number | null; close: () => void }) {
  const today = saoPauloToday();
  const [value, setValue] = useState(contribution ? String(contribution.valor) : ''), [date, setDate] = useState(contribution?.data ?? today), [note, setNote] = useState(contribution?.observacao ?? ''), [error, setError] = useState('');
  const save = useServerFn(saveContribution), qc = useQueryClient();
  const mutation = useMutation({ mutationFn: save, onSuccess: async () => {
    await qc.invalidateQueries({ queryKey: contributionsQuery.queryKey });
    const records = await qc.ensureQueryData(contributionsQuery);
    const annual = effectiveRate(investment, cdi);
    const balance = annual === null ? null : simulateWithContributions(investment, annual, 50, records.filter(c => c.investment_id === investment.id), today).find(m => m.mes === today.slice(0, 7))?.saldo;
    toast.success(balance == null ? 'Aporte salvo. Aguardando CDI para atualizar o saldo.' : `Aporte salvo · novo saldo estimado: ${fmtBRL(balance)}`);
    close();
  }, onError: e => setError(e.message) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: ContributionInput = { investment_id: investment.id, data: date, valor: parseValor(value), observacao: note || null };
    const problem = validateContribution(input, investment.data_inicio, today);
    if (problem) { setError(problem); return; }
    setError(''); mutation.mutate({ data: { id: contribution?.id ?? null, contribution: input } });
  };
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) close(); }}><DialogContent><DialogHeader><DialogTitle>{contribution ? 'Editar aporte' : 'Registrar aporte'} · {investment.nome}</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4" noValidate><div><Label htmlFor="contribution-value">Valor (R$)</Label><Input id="contribution-value" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} autoFocus /></div><div><Label htmlFor="contribution-date">Data</Label><Input id="contribution-date" type="date" min={investment.data_inicio} max={today} value={date} onChange={e => setDate(e.target.value)} /></div><div><Label htmlFor="contribution-note">Observação</Label><Input id="contribution-note" maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={mutation.isPending} className="w-full">{mutation.isPending ? 'Salvando…' : 'Salvar aporte'}</Button></form></DialogContent></Dialog>;
}