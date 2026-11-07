import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { addMonths, CARTOES, faturaMonth, fmtBRL, fmtDate, parcelaLabel, sum } from "@/lib/finance";
import { useMonth, useSettings, useTransactions } from "@/lib/data";
import { Empty, Loading, MonthSelector, Money, PageHeader } from "@/components/app/ui";
import { openTx } from "@/components/app/TxForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cartoes")({
  head: () => ({ meta: [{ title: "Cartões — Finanças Pessoais" }, { name: "description", content: "Faturas dos cartões Nubank." }, { property: "og:title", content: "Cartões — Finanças Pessoais" }, { property: "og:description", content: "Faturas dos cartões Nubank." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Cartoes,
});

function Cartoes() {
  const m = useMonth();
  const [card, setCard] = useState<string>(CARTOES[0]);
  const { data: s } = useSettings();
  const { data: txs, isLoading } = useTransactions(addMonths(m, -1), m);
  const fech = s?.dia_fechamento_cartao ?? 26;
  const items = (txs ?? []).filter((t) => t.forma_pagamento === card && t.tipo === "saida" && faturaMonth(t.data_vencimento, fech) === m);
  return (
    <>
      <PageHeader title="Faturas"><MonthSelector /></PageHeader>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {CARTOES.map((c) => <Button key={c} variant={card === c ? "default" : "outline"} onClick={() => setCard(c)}>{c}</Button>)}
      </div>
      <div className="bg-hero mb-4 rounded-2xl p-5 text-primary-foreground">
        <p className="text-sm opacity-75">{card} · fecha dia {fech}</p>
        <p className="tabular mt-1 font-display text-3xl font-extrabold">{fmtBRL(sum(items))}</p>
      </div>
      {isLoading ? <Loading /> : items.length === 0 ? <Empty icon={<CreditCard className="h-8 w-8" />} title="Fatura vazia" hint="Compras com este cartão aparecem aqui." /> : (
        <div className="card-soft divide-y">
          {items.map((t) => (
            <button key={t.id} onClick={() => openTx({ tx: t })} className="flex w-full justify-between px-3 py-2.5 text-left text-sm">
              <span>{t.descricao} <span className="text-xs text-muted-foreground">{parcelaLabel(t)} · {fmtDate(t.data_vencimento)}</span></span>
              <Money v={t.valor} tipo="saida" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
