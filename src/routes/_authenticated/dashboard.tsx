import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { addMonths, cycleSummaries, fmtBRL, fmtDate, inMonth, isOverdue, monthShort, sum, todayISO, type CycleSummary } from "@/lib/finance";
import { useCategories, useLastMonths, useMonth, useSettings } from "@/lib/data";
import { CatBadge, Loading, MonthSelector, Money, PageHeader, Stat } from "@/components/app/ui";
import { openTx } from "@/components/app/TxForm";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Finanças Pessoais" }, { name: "description", content: "Resumo do mês e dos ciclos." }, { property: "og:title", content: "Dashboard — Finanças Pessoais" }, { property: "og:description", content: "Resumo do mês e dos ciclos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function CycleCard({ c }: { c: CycleSummary }) {
  const row = (l: string, v: number, cls = "") => (
    <div className={`flex justify-between py-1 text-sm ${cls}`}><span className="text-muted-foreground">{l}</span><span className="tabular font-semibold">{fmtBRL(v)}</span></div>
  );
  return (
    <div className="card-soft p-4">
      <p className="font-display text-lg font-bold">Ciclo {c.ciclo} <span className="text-xs font-normal text-muted-foreground">({c.ciclo === 1 ? "dia 08" : "dia 22"})</span></p>
      {row("Entrada", c.entrada, "text-income")}
      {row("Total de contas", c.contas, "text-expense")}
      {row("Líquido", c.liquido, "border-t mt-1 pt-2")}
      {row("Lazer", c.lazer)}
      <div className="mt-2 rounded-lg bg-secondary p-2">{row("Restou p/ guardar", c.restou)}</div>
    </div>
  );
}

function Dashboard() {
  const m = useMonth();
  const { data: txs, isLoading } = useLastMonths(m, 6);
  const { data: cats = [] } = useCategories();
  const { data: settings } = useSettings();
  if (isLoading || !txs || !settings) return <><PageHeader title="Dashboard"><MonthSelector /></PageHeader><Loading /></>;
  const merc = cats.find((c) => c.nome === "Mercado")?.id ?? null;
  const month = txs.filter((t) => inMonth(t, m));
  const ent = month.filter((t) => t.tipo === "entrada");
  const sai = month.filter((t) => t.tipo === "saida");
  const cyc = cycleSummaries(txs, m, settings, merc);
  const today = todayISO();
  const atrasadas = txs.filter((t) => isOverdue(t, today));
  const proximas = sai.filter((t) => !t.pago && t.data_vencimento >= today).slice(0, 6);
  const byCat = cats.map((c) => ({ c, v: sum(sai.filter((t) => t.categoria_id === c.id)) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const bars = Array.from({ length: 6 }, (_, i) => {
    const k = addMonths(m, i - 5);
    const mt = txs.filter((t) => inMonth(t, k));
    return { mes: monthShort(k), Entradas: sum(mt.filter((t) => t.tipo === "entrada")), Saídas: sum(mt.filter((t) => t.tipo === "saida")) };
  });
  const pago = sum(sai.filter((t) => t.pago));

  return (
    <>
      <PageHeader title="Dashboard"><MonthSelector /></PageHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Entradas" value={fmtBRL(sum(ent))} tone="income" />
        <Stat label="Saídas" value={fmtBRL(sum(sai))} tone="expense" />
        <Stat label="Saldo" value={fmtBRL(sum(ent) - sum(sai))} />
        <Stat label="Pago / Pendente" value={fmtBRL(pago)} sub={`Pendente: ${fmtBRL(sum(sai) - pago)}`} />
      </div>

      {atrasadas.length > 0 && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="mb-2 flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> {atrasadas.length} conta(s) atrasada(s)</p>
          {atrasadas.slice(0, 5).map((t) => (
            <button key={t.id} onClick={() => openTx({ tx: t })} className="flex w-full justify-between py-1 text-sm">
              <span>{t.descricao} · {fmtDate(t.data_vencimento)}</span><Money v={t.valor} tipo="saida" />
            </button>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-6 font-display text-lg font-bold">Ciclos do mês</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <CycleCard c={cyc.c1} />
        <CycleCard c={cyc.c2} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Guardar parcial" value={fmtBRL(cyc.guardarParcial)} />
        <Stat label="Bonificações" value={fmtBRL(cyc.bonificacoes)} tone="income" />
        <div className="bg-hero rounded-2xl p-4 text-primary-foreground">
          <p className="text-xs uppercase tracking-wide opacity-75">Total a guardar</p>
          <p className="tabular mt-1 font-display text-xl font-bold">{fmtBRL(cyc.totalGuardar)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card-soft p-4">
          <h3 className="mb-2 font-semibold">Gastos por categoria</h3>
          {byCat.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem gastos neste mês.</p> : (
            <>
              <div className="h-52"><ResponsiveContainer><PieChart><Pie data={byCat.map((x) => ({ name: x.c.nome, value: Math.round(x.v * 100) / 100 }))} dataKey="value" innerRadius={50} outerRadius={85}>{byCat.map((x) => <Cell key={x.c.id} fill={x.c.cor} />)}</Pie><Tooltip formatter={(v: number) => fmtBRL(v)} /></PieChart></ResponsiveContainer></div>
              <div className="space-y-1.5">
                {byCat.map(({ c, v }) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <CatBadge cat={c} />
                    <span className="tabular">{fmtBRL(v)}{c.orcamento_mensal ? <span className={`ml-2 text-xs ${v > c.orcamento_mensal ? "text-destructive" : "text-muted-foreground"}`}>{Math.round((v / c.orcamento_mensal) * 100)}%</span> : null}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="card-soft p-4">
          <h3 className="mb-2 font-semibold">Últimos 6 meses</h3>
          <div className="h-64"><ResponsiveContainer><BarChart data={bars}><XAxis dataKey="mes" fontSize={11} /><Tooltip formatter={(v: number) => fmtBRL(v)} /><Legend /><Bar dataKey="Entradas" fill="var(--income)" radius={4} /><Bar dataKey="Saídas" fill="var(--expense)" radius={4} /></BarChart></ResponsiveContainer></div>
        </div>
      </div>

      <div className="card-soft mt-4 p-4">
        <h3 className="mb-2 font-semibold">Próximos vencimentos</h3>
        {proximas.length === 0 ? <p className="text-sm text-muted-foreground">Nada pendente à frente neste mês. 🎉</p> : proximas.map((t) => (
          <button key={t.id} onClick={() => openTx({ tx: t })} className="flex w-full justify-between border-b py-2 text-left text-sm last:border-0">
            <span>{fmtDate(t.data_vencimento)} · {t.descricao}</span><Money v={t.valor} tipo="saida" />
          </button>
        ))}
      </div>
    </>
  );
}
