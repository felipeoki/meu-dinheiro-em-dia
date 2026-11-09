import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { investmentSchema, type Investment, type InvestmentInput } from '@/lib/investments';
import { saveInvestment } from '@/lib/investments.functions';

export function InvestmentForm({ investment, close }: { investment: Investment | null; close: () => void }) {
  const [form, setForm] = useState<InvestmentInput>(investment ?? { nome: '', valor_inicial: 0, aporte_mensal: 250, data_inicio: `${new Date().toISOString().slice(0, 7)}-01`, tipo_taxa: 'fixa', taxa_anual: 12, percentual_cdi: null, horizonte_anos: 10, capitalizacao: 'nominal', cor: 'primary', ativo: true });
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveInvestment), qc = useQueryClient();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = investmentSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Confira os valores.'); return; }
    setBusy(true);
    try { await save({ data: { id: investment?.id ?? null, investment: parsed.data } }); await qc.invalidateQueries({ queryKey: ['investments'] }); toast.success('Investimento salvo'); close(); }
    catch { toast.error('Não foi possível salvar o investimento.'); }
    finally { setBusy(false); }
  };
  const numberField = (key: 'valor_inicial' | 'aporte_mensal' | 'horizonte_anos', label: string) => <div className="space-y-1"><Label htmlFor={key}>{label}</Label><Input id={key} type="number" min={key === 'horizonte_anos' ? 1 : 0} max={key === 'horizonte_anos' ? 50 : undefined} step={key === 'horizonte_anos' ? 1 : '0.01'} required value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} /></div>;
  return <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{investment ? 'Editar investimento' : 'Novo investimento'}</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4">
    <div className="space-y-1"><Label htmlFor="investment-name">Nome</Label><Input id="investment-name" autoFocus required maxLength={120} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
    <div className="grid grid-cols-2 gap-3">{numberField('valor_inicial', 'Valor inicial (R$)')}{numberField('aporte_mensal', 'Aporte mensal (R$)')}<div className="space-y-1"><Label htmlFor="investment-start">Mês de início</Label><Input id="investment-start" type="month" required value={form.data_inicio.slice(0, 7)} onChange={e => setForm({ ...form, data_inicio: `${e.target.value}-01` })} /></div>{numberField('horizonte_anos', 'Horizonte (anos)')}</div>
    <div className="space-y-1"><Label>Tipo de taxa</Label><div className="flex gap-2">{(['fixa', 'cdi'] as const).map(tipo => <Button type="button" key={tipo} variant={form.tipo_taxa === tipo ? 'default' : 'outline'} onClick={() => setForm({ ...form, tipo_taxa: tipo, taxa_anual: tipo === 'fixa' ? 12 : null, percentual_cdi: tipo === 'cdi' ? 100 : null })}>{tipo === 'fixa' ? 'Fixa' : '% do CDI'}</Button>)}</div></div>
    <div className="space-y-1"><Label htmlFor="investment-rate">{form.tipo_taxa === 'fixa' ? 'Taxa anual (% a.a.)' : 'Percentual do CDI (%)'}</Label><Input id="investment-rate" type="number" min={0} max={form.tipo_taxa === 'fixa' ? 100 : 1000} step="0.01" required value={(form.tipo_taxa === 'fixa' ? form.taxa_anual : form.percentual_cdi) ?? ''} onChange={e => setForm({ ...form, [form.tipo_taxa === 'fixa' ? 'taxa_anual' : 'percentual_cdi']: Number(e.target.value) })} /></div>
    <div className="space-y-1"><Label htmlFor="investment-mode">Capitalização</Label><select id="investment-mode" className="h-10 w-full rounded-md border bg-card px-3" value={form.capitalizacao} onChange={e => setForm({ ...form, capitalizacao: e.target.value === 'composta' ? 'composta' : 'nominal' })}><option value="nominal">Nominal (taxa anual ÷ 12)</option><option value="composta">Composta (taxa mensal equivalente)</option></select></div>
    <fieldset className="space-y-2"><legend className="text-sm font-medium">Cor</legend><div className="flex gap-3">{(['primary', 'chart-2', 'chart-4', 'chart-5'] as const).map((cor, i) => <Button type="button" key={cor} variant="outline" size="icon" aria-label={`Cor ${i + 1}`} aria-pressed={form.cor === cor} onClick={() => setForm({ ...form, cor })} className={form.cor === cor ? 'ring-2 ring-ring' : ''}><span className={`h-5 w-5 rounded-full ${ { primary: 'bg-primary', 'chart-2': 'bg-chart-2', 'chart-4': 'bg-chart-4', 'chart-5': 'bg-chart-5' }[cor] }`} /></Button>)}</div></fieldset>
    <Button className="w-full" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar investimento'}</Button>
  </form></DialogContent></Dialog>;
}