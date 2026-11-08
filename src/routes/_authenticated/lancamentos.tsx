import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, ListChecks } from "lucide-react";
import { personalTransactions, fmtBRL, isOverdue, parcelaLabel, sum, dayOf } from "@/lib/finance";
import { useAccounts, useCategories, useMonth, useMonthTx, useTogglePaid } from "@/lib/data";
import { CatBadge, Empty, Loading, MonthSelector, Money, PageHeader } from "@/components/app/ui";
import { openTx } from "@/components/app/TxForm";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({ meta: [{ title: "Lançamentos — Finanças Pessoais" }, { name: "description", content: "Contas do mês por dia de vencimento." }, { property: "og:title", content: "Lançamentos — Finanças Pessoais" }, { property: "og:description", content: "Contas do mês por dia de vencimento." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Lancamentos,
});

const sel = "h-9 rounded-md border border-input bg-card px-2 text-sm";

function Lancamentos() {
  const m = useMonth();
  const { data: accounts = [] } = useAccounts();
  const { data: txs, isLoading } = useMonthTx(m);
  const { data: cats = [] } = useCategories();
  const toggle = useTogglePaid();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [forma, setForma] = useState("");
  const [st, setSt] = useState("");

  const list = (txs ?? []).filter(
    (t) =>
      (!q || t.descricao.toLowerCase().includes(q.toLowerCase())) &&
      (!cat || t.categoria_id === cat) &&
      (!forma || t.conta_id === forma) &&
      (!st || (st === "pago" ? t.pago : !t.pago)),
  );
  const groups = new Map<number, typeof list>();
  list.forEach((t) => groups.set(dayOf(t.data_vencimento), [...(groups.get(dayOf(t.data_vencimento)) ?? []), t]));

  return (
    <>
      <PageHeader title="Lançamentos"><MonthSelector /></PageHeader>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Input className="col-span-2 md:col-span-1" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Categorias</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <select className={sel} value={forma} onChange={(e) => setForma(e.target.value)}><option value="">Formas</option>{accounts.filter(a => a.ativo).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
        <select className={sel} value={st} onChange={(e) => setSt(e.target.value)}><option value="">Status</option><option value="pago">Pago</option><option value="pendente">Pendente</option></select>
      </div>
      {isLoading ? <Loading /> : list.length === 0 ? (
        <Empty icon={<ListChecks className="h-8 w-8" />} title="Nenhum lançamento por aqui" hint="Toque no + para adicionar." />
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([day, items]) => (
            <section key={day}>
              <div className="mb-1.5 flex justify-between px-1 text-sm">
                <span className="font-display font-bold">Dia {day}</span>
                <span className="tabular text-muted-foreground">{fmtBRL(sum(personalTransactions(items).filter((t) => t.tipo === "saida")))}</span>
              </div>
              <div className="card-soft divide-y">
                {items.map((t) => (
                  <div key={t.id} className={cn("flex items-center gap-3 px-3 py-2.5", isOverdue(t) && "bg-destructive/10")}>
                    <input type="checkbox" aria-label="Pago" className="h-5 w-5 accent-[var(--primary)]" checked={t.pago} onChange={(e) => toggle.mutate({ id: t.id, pago: e.target.checked })} />
                    <button className="min-w-0 flex-1 text-left" onClick={() => openTx({ tx: t })}>
                      <p className={cn("truncate text-sm font-medium", t.pago && "text-muted-foreground line-through")}>{t.descricao || "—"}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <CatBadge cat={cats.find((c) => c.id === t.categoria_id)} />
                        <span className="text-[11px] text-muted-foreground">{parcelaLabel(t)} · {accounts.find(a => a.id === t.conta_id)?.nome ?? "Sem conta"}</span>
                        {t.nao_contabilizar && <span className="text-[11px] text-warning-foreground">{t.recebido ? "Recebido" : "A receber"}</span>}
                        {isOverdue(t) && !t.nao_contabilizar && <span className="text-[11px] font-semibold text-destructive">Atrasada</span>}
                      </div>
                    </button>
                    {t.nao_contabilizar ? <span className="tabular text-sm text-muted-foreground">{fmtBRL(t.valor)}</span> : <Money v={t.valor} tipo={t.tipo} className="text-sm" />}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <button aria-label="Novo lançamento" onClick={() => openTx({})} className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:bottom-8">
        <Plus className="h-6 w-6" />
      </button>
    </>
  );
}
