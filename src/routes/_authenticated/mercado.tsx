import { createFileRoute } from "@tanstack/react-router";
import { Plus, ShoppingCart } from "lucide-react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { addMonths, envelopeStatus, fmtBRL, fmtDate, inMonth, monthShort, sum, todayISO, dateInMonth } from "@/lib/finance";
import { useCategories, useLastMonths, useMonth, useSettings } from "@/lib/data";
import { Empty, Loading, MonthSelector, Money, PageHeader } from "@/components/app/ui";
import { openTx } from "@/components/app/TxForm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mercado")({
  head: () => ({ meta: [{ title: "Mercado — Finanças Pessoais" }, { name: "description", content: "Envelope mensal do mercado." }, { property: "og:title", content: "Mercado — Finanças Pessoais" }, { property: "og:description", content: "Envelope mensal do mercado." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Mercado,
});

function Mercado() {
  const m = useMonth();
  const { data: txs, isLoading } = useLastMonths(m, 6);
  const { data: cats = [] } = useCategories();
  const { data: s } = useSettings();
  const merc = cats.find((c) => c.nome === "Mercado");
  if (isLoading || !s || !txs) return <><PageHeader title="Mercado"><MonthSelector /></PageHeader><Loading /></>;
  const orc = merc?.orcamento_mensal ?? s.orcamento_mercado;
  const compras = txs.filter((t) => inMonth(t, m) && t.tipo === "saida" && t.categoria_id === merc?.id);
  const gasto = sum(compras);
  const status = envelopeStatus(gasto, orc);
  const pct = Math.min(100, (gasto / orc) * 100);
  const hist = Array.from({ length: 6 }, (_, i) => {
    const k = addMonths(m, i - 5);
    return { mes: monthShort(k), v: Math.round(sum(txs.filter((t) => inMonth(t, k) && t.tipo === "saida" && t.categoria_id === merc?.id)) * 100) / 100 };
  });
  const nova = () =>
    openTx({ defaults: { tipo: "saida", categoria_id: merc?.id ?? null, descricao: "Compra mercado", forma_pagamento: "Dinheiro/Pix", pago: true, data_vencimento: todayISO().startsWith(m) ? todayISO() : dateInMonth(m, 1) } });

  return (
    <>
      <PageHeader title="Mercado"><MonthSelector /></PageHeader>
      <div className="card-soft p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Disponível para uso</p>
            <p className={cn("tabular font-display text-3xl font-extrabold", status === "estourou" ? "text-destructive" : "text-income")}>{fmtBRL(orc - gasto)}</p>
          </div>
          <p className="text-right text-sm text-muted-foreground">Gasto {fmtBRL(gasto)}<br />de {fmtBRL(orc)}</p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", status === "estourou" ? "bg-destructive" : status === "alerta" ? "bg-warning" : "bg-income")} style={{ width: `${pct}%` }} />
        </div>
        {status === "estourou" && <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-sm font-semibold text-destructive">Estourou {fmtBRL(gasto - orc)}</p>}
        {status === "alerta" && <p className="mt-3 rounded-lg bg-warning/25 p-2 text-sm font-semibold text-warning-foreground">Atenção: já usou {Math.round(pct)}% do orçamento</p>}
        <Button className="mt-4 w-full" onClick={nova}><Plus /> Lançar compra</Button>
      </div>

      <div className="card-soft mt-4 p-4">
        <h3 className="mb-2 font-semibold">Histórico</h3>
        <div className="h-52"><ResponsiveContainer><BarChart data={hist}><XAxis dataKey="mes" fontSize={11} /><Tooltip formatter={(v: number) => fmtBRL(v)} /><ReferenceLine y={orc} stroke="var(--foreground)" strokeDasharray="4 4" /><Bar dataKey="v" name="Gasto" radius={4}>{hist.map((h, i) => <Cell key={i} fill={h.v > orc ? "var(--expense)" : "var(--income)"} />)}</Bar></BarChart></ResponsiveContainer></div>
      </div>

      <h3 className="mb-2 mt-5 font-display font-bold">Compras do mês ({compras.length})</h3>
      {compras.length === 0 ? <Empty icon={<ShoppingCart className="h-8 w-8" />} title="Nenhuma compra lançada" hint="Use “Lançar compra” acima." /> : (
        <div className="card-soft divide-y">
          {compras.map((t) => (
            <button key={t.id} onClick={() => openTx({ tx: t })} className="flex w-full justify-between px-3 py-2.5 text-left text-sm">
              <span><span className="text-muted-foreground">{fmtDate(t.data_vencimento)}</span> · {t.descricao}</span>
              <Money v={t.valor} tipo="saida" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
