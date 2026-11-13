import { fmtBRL, monthLabel, type CycleSummary } from "@/lib/finance";
import type { ProjectedMonth } from "@/lib/cycle-projection";

const tone = (value: number) => value < 0 ? "text-expense" : "text-income";
export function ProjectionMonth({ month }: { month: ProjectedMonth }) {
  const statusTone = month.status === "Negativo" ? "bg-destructive/10 text-destructive" : month.status === "Apertado" ? "bg-warning/20 text-warning-foreground" : "bg-income/10 text-income";
  return <details className="min-w-0 rounded-lg border bg-card" data-projection-month={month.month}>
    <summary className="block cursor-pointer list-none p-4 focus-visible:outline focus-visible:outline-ring">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-lg font-bold">{monthLabel(month.month)}</h3><span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusTone}`}>{month.status}</span></div>
      <p className="mt-1 text-xs text-muted-foreground">{month.future ? "Cadastrado + estimativas" : "Mês atual · cadastrado"}</p>
      <div className="my-4 grid grid-cols-2 gap-3">
        {([month.cycles.c1, month.cycles.c2] as CycleSummary[]).map(c => <div key={c.ciclo}><p className="text-xs text-muted-foreground">Sobra Ciclo {c.ciclo}</p><p className={`tabular font-semibold ${tone(c.restou)}`}>{fmtBRL(c.restou)}</p></div>)}
        <div className="col-span-2 flex justify-between gap-2 text-sm"><span className="text-muted-foreground">Bonificações</span><span className="tabular">{fmtBRL(month.cycles.bonificacoes)}</span></div>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3"><span className="text-xs font-semibold">TOTAL A GUARDAR</span><strong className={`tabular text-xl ${tone(month.cycles.totalGuardar)}`}>{fmtBRL(month.cycles.totalGuardar)}</strong></div>
      {month.events.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{month.events.map(e => <span key={e.id} className="max-w-full break-words rounded-md bg-secondary px-2 py-1 text-xs">Termina: {e.description} · libera {fmtBRL(e.value)}/mês</span>)}</div>}
      <span className="mt-3 block text-right text-xs text-muted-foreground">Detalhamento dos ciclos ▾</span>
    </summary>
    <div className="grid gap-5 border-t p-4 lg:grid-cols-2">{month.details.map(c => <section key={c.ciclo} className="min-w-0">
      <h4 className="mb-2 font-semibold">Ciclo {c.ciclo}</h4>
      <dl className="space-y-1 text-sm">{([["Entrada", c.entrada], ["− Contas", c.contas], ["− Lazer", c.lazer], ["= Sobra", c.restou]] as const).map(([label, value]) => <div key={label} className="flex justify-between gap-2"><dt>{label}</dt><dd className={`tabular font-semibold ${label === "= Sobra" ? tone(value) : ""}`}>{fmtBRL(value)}</dd></div>)}</dl>
      <p className="mb-1 mt-4 text-xs font-semibold text-muted-foreground">Maiores contas · cadastrado</p>
      {c.largest.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada.</p> : <ul className="space-y-2 text-xs">{c.largest.map(t => <li key={t.id} className="flex items-start justify-between gap-2"><span className="min-w-0 break-words">{t.descricao || "Sem descrição"}</span><span className="tabular shrink-0">{fmtBRL(t.valor)}</span></li>)}</ul>}
      {c.market != null && <div className="mt-3 border-t pt-2 text-xs"><div className="flex justify-between gap-2"><span>{month.future ? "Mercado previsto" : "Mercado Mensal"}</span><strong className="tabular shrink-0">{fmtBRL(c.market)}</strong></div><p className="mt-1 text-muted-foreground">{month.future && c.marketRegistered < c.market ? `Estimado · cadastrado ${fmtBRL(c.marketRegistered)}` : c.marketRegistered >= c.market ? "Cadastrado · gasto do mês" : "Envelope das configurações"}</p></div>}
      {month.future && c.ciclo === 2 && <div className="mt-3 border-t pt-2 text-xs"><div className="flex justify-between gap-2"><span>Gastos variáveis do cartão (estimativa)</span><strong className="tabular shrink-0">{fmtBRL(c.variable)}</strong></div><p className="mt-1 text-muted-foreground">Estimado · vencimento dia 26</p></div>}
      <p className="mt-3 text-xs text-muted-foreground">Entrada e bonificações: cadastrado{month.future ? " / recorrência projetada" : ""}. Lazer: {month.future ? "premissa" : "configuração"}.</p>
    </section>)}</div>
  </details>;
}