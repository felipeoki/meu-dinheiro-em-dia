import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { addMonths, fmtBRL, monthLabel, monthShort, projection, todayISO } from "@/lib/finance";
import { useAccounts, useCategories, useSettings } from "@/lib/data";
import { defaultAssumptions, projectCycles, projectionSummary, extendProjectionFixed, CYCLE_HORIZONS, type Assumptions } from "@/lib/cycle-projection";
import { projectionTransactionsQuery } from "@/lib/cycle-projection.queries";
import { Loading, PageHeader, Stat } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ProjectionMonth } from "@/components/app/ProjectionMonth";
import { ProjectionAccountDetail } from "@/components/app/ProjectionAccountDetail";

export const Route = createFileRoute("/_authenticated/projecao")({
  loader: ({ context }) => context.queryClient.ensureQueryData(projectionTransactionsQuery(addMonths(todayISO().slice(0, 7), 23))),
  head: () => ({ meta: [
    { title: "Projeção por ciclo — Finanças Pessoais" },
    { name: "description", content: "Sobras por ciclo, estimativas mensais e término das parcelas." },
    { property: "og:title", content: "Projeção por ciclo — Finanças Pessoais" },
    { property: "og:description", content: "Sobras por ciclo, estimativas mensais e término das parcelas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Projecao,
});

function Projecao() {
  const start = todayISO().slice(0, 7);
  const [horizon, setHorizon] = useState(12);
  const [override, setOverride] = useState<Partial<Assumptions>>({});
  const [registeredOnly, setRegisteredOnly] = useState(false);
  const { data: txs } = useSuspenseQuery(projectionTransactionsQuery(addMonths(start, 23)));
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts();
  const { data: settings } = useSettings();
  if (!settings || loadingCategories || loadingAccounts) return <><PageHeader title="Projeção" /><Loading /></>;
  const marketId = categories.find(c => c.nome === "Mercado")?.id ?? null;
  const defaults = defaultAssumptions(txs, start, settings, marketId, accounts);
  const assumptions = { ...defaults, ...override, variableCards: registeredOnly ? 0 : override.variableCards ?? defaults.variableCards };
  const months = projectCycles(txs, start, horizon, settings, marketId, assumptions);
  const summary = projectionSummary(months);
  const current = months[0];
  const marketSpent = current?.details.find(c => c.market != null)?.marketRegistered ?? 0;
  const extended = extendProjectionFixed(txs, addMonths(start, horizon - 1));
  const endings = projection(extended, start, horizon, settings, marketId).endings;
  const chart = months.map(m => ({ label: monthShort(m.month), c1: m.cycles.c1.restou, c2: m.cycles.c2.restou, total: m.cycles.totalGuardar }));
  const update = (key: keyof Assumptions, raw: string) => {
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) setOverride(previous => ({ ...previous, [key]: value }));
  };
  const improvement = summary.improvement;
  return <div className="min-w-0 space-y-5">
    <PageHeader title="Projeção"><span className="text-sm text-muted-foreground">A partir de {monthLabel(start)}</span></PageHeader>
    <div role="group" aria-label="Horizonte da projeção" className="flex flex-wrap gap-2">{CYCLE_HORIZONS.map(n => <Button key={n} variant={n === horizon ? "default" : "outline"} aria-pressed={n === horizon} onClick={() => setHorizon(n)}>{n} meses</Button>)}</div>
    <details className="border-y py-3"><summary className="cursor-pointer font-semibold">Premissas desta projeção</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><label htmlFor="projection-market" className="text-sm font-medium">Mercado por mês (futuro)</label><Input id="projection-market" type="number" min="0" step="0.001" value={assumptions.market} onChange={e => update("market", e.target.value)} />{marketSpent > settings.orcamento_mercado && <p className="mt-2 text-xs text-warning-foreground">Em {monthLabel(start)} você gastou {fmtBRL(marketSpent)}, {fmtBRL(marketSpent - settings.orcamento_mercado)} acima do orçamento.</p>}</div>
        <div><label htmlFor="projection-variable" className="text-sm font-medium">Gastos variáveis de cartão por mês</label><Input id="projection-variable" type="number" min="0" step="0.001" disabled={registeredOnly} value={assumptions.variableCards} onChange={e => update("variableCards", e.target.value)} /><p className="mt-2 text-xs text-muted-foreground">Estimativa baseada em {monthLabel(start)} · {fmtBRL(defaults.variableCards)}</p></div>
        <div><label htmlFor="projection-leisure" className="text-sm font-medium">Lazer por ciclo (futuro)</label><Input id="projection-leisure" type="number" min="0" step="0.01" value={assumptions.leisure} onChange={e => update("leisure", e.target.value)} /></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><Switch checked={registeredOnly} onCheckedChange={setRegisteredOnly} aria-label="Considerar só contas já cadastradas" />Considerar só contas já cadastradas (variáveis = 0)</label><Button variant="outline" onClick={() => { setOverride({}); setRegisteredOnly(false); }}><RotateCcw />Restaurar padrão</Button></div>
    </details>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Sobra média por mês" value={fmtBRL(summary.average)} />
      <Stat label="Total previsto para guardar no período" value={fmtBRL(summary.total)} />
      <Stat label="Melhor mês" value={fmtBRL(summary.best?.cycles.totalGuardar ?? 0)} sub={summary.best ? monthLabel(summary.best.month) : "—"} />
      <Stat label="Mês mais apertado" value={fmtBRL(summary.worst?.cycles.totalGuardar ?? 0)} sub={summary.worst ? monthLabel(summary.worst.month) : "—"} />
    </div>
    <section className="border-l-4 border-income bg-income/5 p-4"><h2 className="font-semibold">Quando melhora</h2>{improvement ? <p className="mt-1 text-sm">Em {monthShort(improvement.month)} a sobra sobe de <strong>{fmtBRL(improvement.before)}</strong> para <strong>{fmtBRL(improvement.after)}</strong>{improvement.endings.length ? ` porque terminam: ${improvement.endings.map(e => e.description).join(", ")}.` : improvement.marketDifference > 0 ? " com a redução do mercado previsto em relação ao gasto atual." : improvement.incomeDifference > 0 ? " com o aumento das entradas cadastradas." : " com a mudança das contas cadastradas e premissas do mês."}</p> : <p className="mt-1 text-sm text-muted-foreground">Sem melhora relevante neste período.</p>}<p className="mt-2 text-xs text-muted-foreground">Melhora relevante: aumento de pelo menos R$ 100 e 10% do total anterior.</p></section>
    {months.some(m => m.alerts.length) && <section aria-label="Ciclos negativos" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4">{months.flatMap(m => m.alerts).map(a => <p key={`${a.month}-${a.cycle}`} className="flex items-start gap-2 text-sm font-medium text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Ciclo {a.cycle} de {monthShort(a.month)} fica {fmtBRL(a.deficit)} negativo</p>)}</section>}
    <section className="min-w-0"><h2 className="mb-3 font-display text-lg font-bold">Sobra por ciclo</h2><div className="h-80 w-full min-w-0" role="img" aria-label="Gráfico mensal de sobra dos dois ciclos e total a guardar"><ResponsiveContainer width="100%" height="100%"><ComposedChart accessibilityLayer data={chart} margin={{ top: 10, right: 8, left: 0, bottom: 5 }}><XAxis dataKey="label" fontSize={10} minTickGap={12} /><YAxis width={48} fontSize={10} tickFormatter={v => `${Number(v) / 1000} mil`} /><Tooltip formatter={(v: number) => fmtBRL(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine y={0} stroke="var(--border)" /><Bar dataKey="c1" name="Sobra Ciclo 1" fill="var(--income)" radius={[3, 3, 0, 0]}>{chart.map(m => <Cell key={m.label} fill={m.c1 < 0 ? "var(--expense)" : "var(--income)"} />)}</Bar><Bar dataKey="c2" name="Sobra Ciclo 2" fill="var(--income)" fillOpacity={0.55} radius={[3, 3, 0, 0]}>{chart.map(m => <Cell key={m.label} fill={m.c2 < 0 ? "var(--expense)" : "var(--income)"} />)}</Bar><Line dataKey="total" name="Total a guardar" stroke="var(--primary)" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div></section>
    <p className="text-xs text-muted-foreground">Meses futuros incluem estimativas; só o mês atual reflete o que já está cadastrado.</p>
    <section><h2 className="mb-3 font-display text-lg font-bold">Mês a mês</h2><div className="grid items-start gap-3 md:grid-cols-2">{months.map(m => <ProjectionMonth key={m.month} month={m} />)}</div></section>
    <section><h2 className="mb-3 font-display text-lg font-bold">O que termina nos próximos meses</h2>{endings.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma parcela termina neste período.</p> : <div className="divide-y">{endings.map(e => <div key={e.id} className="py-3 text-sm"><p>Em {monthShort(e.end ?? "")} termina <strong>{e.tx.descricao}</strong>: libera {fmtBRL(e.liberado)}/mês</p><p className="mt-1 text-muted-foreground">Acumulado liberado: {fmtBRL(e.acumulado)}/mês</p></div>)}</div>}</section>
    <ProjectionAccountDetail txs={extended} start={start} horizon={horizon} settings={settings} marketId={marketId} categories={categories} accounts={accounts} />
  </div>;
}
