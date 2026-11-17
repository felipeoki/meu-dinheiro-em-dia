import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Plus, ListChecks, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { isPersonalTransaction, personalTransactions, fmtBRL, isOverdue, parcelaLabel, sum, dayOf } from "@/lib/finance";
import { useAccounts, useCategories, useMonth, useMonthTx, useTogglePaid } from "@/lib/data";
import { CatBadge, Empty, Loading, MonthSelector, Money, PageHeader } from "@/components/app/ui";
import { openTx } from "@/components/app/TxForm";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { selectionSummary, selectionWhatsAppText, toggleSelection } from "@/lib/transaction-selection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { provisionsQuery } from "@/lib/provisions.queries";
import { BulkProvisionAction, ProvisionAction } from "@/components/app/ProvisionControls";
import { TransactionList } from "@/components/app/TransactionList";
import { MonthPdfButton } from "@/components/app/MonthPdfButton";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({ meta: [{ title: "Lançamentos — Finanças Pessoais" }, { name: "description", content: "Contas do mês por dia de vencimento." }, { property: "og:title", content: "Lançamentos — Finanças Pessoais" }, { property: "og:description", content: "Contas do mês por dia de vencimento." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Lancamentos,
});

const sel = "h-9 rounded-md border border-input bg-card px-2 text-sm";

function Lancamentos() {
  const m = useMonth();
  return <MonthLaunches key={m} month={m} />;
}

function MonthLaunches({ month: m }: { month: string }) {
  const { data: accounts = [] } = useAccounts();
  const { data: txs, isLoading } = useMonthTx(m);
  const { data: cats = [] } = useCategories();
  const toggle = useTogglePaid();
  const { data: provisions = [] } = useQuery(provisionsQuery);
  const [view, setView] = useState<"lista" | "dia">("lista");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [forma, setForma] = useState("");
  const [st, setSt] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const list = (txs ?? []).filter(
    (t) =>
      (!q || t.descricao.toLowerCase().includes(q.toLowerCase())) &&
      (!cat || t.categoria_id === cat) &&
      (!responsavel || t.responsavel === responsavel) &&
      (!forma || t.conta_id === forma) &&
      (!st || (st === "pago" ? t.pago : !t.pago)),
  ).sort((a,b) => a.data_vencimento.localeCompare(b.data_vencimento) || a.descricao.localeCompare(b.descricao, 'pt-BR') || a.id.localeCompare(b.id));
  const groups = new Map<number, typeof list>();
  list.forEach((t) => groups.set(dayOf(t.data_vencimento), [...(groups.get(dayOf(t.data_vencimento)) ?? []), t]));
  const selectedRows = (txs ?? []).filter((t) => selected.has(t.id));
  const summary = selectionSummary(selectedRows);
  const whatsAppText = selectionWhatsAppText(selectedRows, m);
  const copyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsAppText);
      toast.success("Texto copiado");
    } catch {
      textRef.current?.focus();
      textRef.current?.select();
      toast.error("Não foi possível copiar automaticamente. O texto está selecionado para copiar.");
    }
  };
  const hiddenCount = selectedRows.length - list.filter((t) => selected.has(t.id)).length;
  const selectRows = (ids: string[], checked: boolean) => setSelected((current) => toggleSelection(current, ids, checked));
  const groupState = (ids: string[]): boolean | "indeterminate" => {
    const count = ids.filter((id) => selected.has(id)).length;
    return count === 0 ? false : count === ids.length ? true : "indeterminate";
  };

  return (
    <div className={cn(summary.quantidade > 0 && "pb-64 md:pb-32")}>
      <PageHeader title="Lançamentos"><MonthSelector /></PageHeader>
      <div role="group" aria-label="Visualização" className="mb-4 flex gap-1">
        <Button size="sm" variant={view === "lista" ? "default" : "outline"} aria-pressed={view === "lista"} onClick={() => setView("lista")}>Lista</Button>
        <Button size="sm" variant={view === "dia" ? "default" : "outline"} aria-pressed={view === "dia"} onClick={() => setView("dia")}>Por dia</Button>
        <div className="ml-auto"><MonthPdfButton month={m} /></div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Input className="col-span-2 md:col-span-1" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Categorias</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <select className={sel} value={forma} onChange={(e) => setForma(e.target.value)}><option value="">Formas</option>{accounts.filter(a => a.ativo).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
        <select className={sel} value={st} onChange={(e) => setSt(e.target.value)}><option value="">Status</option><option value="pago">Pago</option><option value="pendente">Pendente</option></select>
        <select aria-label="Responsável" className={sel} value={responsavel} onChange={e => setResponsavel(e.target.value)}><option value="">Responsável: Todos</option><option value="Felipe">Felipe</option><option value="Jéssica">Jéssica</option></select>
      </div>
      {list.length > 0 && (
        <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox aria-label="Selecionar todos os visíveis" checked={groupState(list.map((t) => t.id))} onCheckedChange={(checked) => selectRows(list.map((t) => t.id), checked === true)} />
          Selecionar todos os visíveis
        </label>
      )}
      {isLoading ? <Loading /> : list.length === 0 ? (
        <Empty icon={<ListChecks className="h-8 w-8" />} title="Nenhum lançamento por aqui" hint="Toque no + para adicionar." />
      ) : view === "lista" ? (
        <TransactionList rows={list} cats={cats} accounts={accounts} provisions={provisions} selected={selected} select={(id, checked) => selectRows([id], checked)} pay={(id, pago) => toggle.mutate({id,pago}, {onError: () => toast.error("Não foi possível alterar o pagamento.")})} />
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([day, items]) => (
            <section key={day}>
              <div className="mb-1.5 flex justify-between px-1 text-sm">
                <label className="flex cursor-pointer items-center gap-2 font-display font-bold">
                  <Checkbox aria-label={`Selecionar dia ${day}`} checked={groupState(items.map((t) => t.id))} onCheckedChange={(checked) => selectRows(items.map((t) => t.id), checked === true)} />
                  Dia {day}
                </label>
                <span className="tabular text-muted-foreground">{fmtBRL(sum(personalTransactions(items).filter((t) => t.tipo === "saida")))}</span>
              </div>
              <div className="card-soft divide-y">
                {items.map((t) => (
                  <div key={t.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3", isOverdue(t) && "bg-destructive/10", selected.has(t.id) && "bg-primary/10")}>
                    <input type="checkbox" aria-label="Pago" className="h-5 w-5 accent-[var(--primary)]" checked={t.pago} onChange={(e) => toggle.mutate({ id: t.id, pago: e.target.checked })} />
                    <button className="min-w-0 flex-1 text-left" onClick={() => openTx({ tx: t })}>
                      <p className={cn("truncate text-sm font-medium", t.pago && "text-muted-foreground line-through")}>{t.descricao || "—"}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <CatBadge cat={cats.find((c) => c.id === t.categoria_id)} />
                        <span className="text-[11px] text-muted-foreground">{parcelaLabel(t)} · {accounts.find(a => a.id === t.conta_id)?.nome ?? "Sem conta"}</span>
                        {t.responsavel === "Jéssica" && <span className="rounded bg-responsible/10 px-1.5 text-[11px] text-responsible" title="Não entra nas minhas contas">Jéssica</span>}
                        {t.nao_contabilizar && <span className="text-[11px] text-warning-foreground">{t.recebido ? "Recebido" : "A receber"}</span>}
                        {isOverdue(t) && !t.nao_contabilizar && <span className="text-[11px] font-semibold text-destructive">Atrasada</span>}
                         {provisions.some(p => p.transaction_id === t.id && p.status === "provisionado") && <span className="text-[11px] font-semibold text-primary">Provisionado</span>}
                      </div>
                    </button>
                    {!isPersonalTransaction(t) ? <span title="Não entra nas minhas contas" className="tabular text-sm text-muted-foreground">{fmtBRL(t.valor)}</span> : <Money v={t.valor} tipo={t.tipo} className="text-sm" />}
                    <Checkbox aria-label="Selecionar para somar" className="h-5 w-5" checked={selected.has(t.id)} onCheckedChange={(checked) => selectRows([t.id], checked === true)} />
                     <div className="w-full pl-7"><ProvisionAction tx={t} provision={provisions.find(p => p.transaction_id === t.id && p.status === "provisionado")} /></div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <Button aria-label="Novo lançamento" onClick={() => openTx({})} className={cn("fixed bottom-20 right-5 z-30 h-14 w-14 rounded-full shadow-lg md:bottom-8", summary.quantidade > 0 && "bottom-[calc(15rem+env(safe-area-inset-bottom))] md:bottom-36")}>
        <Plus className="h-6 w-6" />
      </Button>
      {summary.quantidade > 0 && (
        <section aria-label="Soma da seleção" className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t bg-card p-3 shadow-lg md:bottom-0 md:left-60 md:p-4">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div aria-live="polite" aria-atomic="true" className="min-w-0 flex-1 basis-full md:basis-auto">
              <p className="text-sm font-semibold">{summary.quantidade} selecionado{summary.quantidade === 1 ? "" : "s"}</p>
              {hiddenCount > 0 && <p className="text-xs text-warning-foreground">{hiddenCount} oculto{hiddenCount === 1 ? "" : "s"} pelos filtros · incluído{hiddenCount === 1 ? "" : "s"} na soma</p>}
              {summary.misturada ? (
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs sm:text-sm">
                  <div><dt className="text-muted-foreground">Saídas</dt><dd className="tabular font-semibold text-expense">{fmtBRL(summary.saidasCentavos / 100)}</dd></div>
                  <div><dt className="text-muted-foreground">Entradas</dt><dd className="tabular font-semibold text-income">{fmtBRL(summary.entradasCentavos / 100)}</dd></div>
                  <div><dt className="text-muted-foreground">Saldo</dt><dd className="tabular font-semibold">{fmtBRL(summary.saldoCentavos / 100)}</dd></div>
                </dl>
              ) : <p className="tabular mt-1 text-lg font-bold">Soma: {fmtBRL(summary.totalCentavos / 100)}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
               <BulkProvisionAction rows={selectedRows} />
              <Button variant="outline" size="sm" onClick={() => setShowWhatsApp(true)}><MessageCircle />Texto para WhatsApp</Button>
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
            </div>
          </div>
        </section>
      )}
      <Dialog open={showWhatsApp} onOpenChange={setShowWhatsApp}>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>Texto para WhatsApp</DialogTitle>
            <DialogDescription>{summary.quantidade} lançamento{summary.quantidade === 1 ? "" : "s"} selecionado{summary.quantidade === 1 ? "" : "s"}{hiddenCount > 0 ? `, incluindo ${hiddenCount} oculto${hiddenCount === 1 ? "" : "s"} pelos filtros` : ""}.</DialogDescription>
          </DialogHeader>
          <textarea ref={textRef} aria-label="Texto dos lançamentos selecionados" readOnly value={whatsAppText} className="h-72 w-full resize-none rounded-md border border-input bg-card p-3 text-sm leading-relaxed" />
          <Button onClick={copyWhatsApp}><Copy />Copiar texto</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
