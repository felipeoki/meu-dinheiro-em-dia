import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Scale, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAccounts, useCategories, useMonth, useMonthTx, useSettings } from "@/lib/data";
import { fmtBRL, monthLabel, parseValor, todayISO } from "@/lib/finance";
import {
  METRICS,
  METRIC_KEYS,
  actualTotals,
  compareExpectedTotals,
  emptyExpectedTotals,
  type AiAnalysis,
  type ExpectedTotals,
  type MetricKey,
  type ReconciliationResult,
} from "@/lib/reconciliation";
import { reconcileExpectedTotals } from "@/lib/reconciliation.functions";
import { openTx } from "@/components/app/TxForm";
import { Loading, MonthSelector, PageHeader } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/conferencia")({
  head: () => ({ meta: [
    { title: "Conferência inteligente — Finanças Pessoais" },
    { name: "description", content: "Compare totais esperados com os relatórios e investigue divergências com inteligência artificial." },
    { property: "og:title", content: "Conferência inteligente — Finanças Pessoais" },
    { property: "og:description", content: "Compare totais esperados com os relatórios e investigue divergências com inteligência artificial." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Conferencia,
});

type ExpectedForm = Record<MetricKey, string>;
const blankForm = (): ExpectedForm => Object.fromEntries(METRIC_KEYS.map(key => [key, ""])) as ExpectedForm;
const storageKey = (month: string) => `financas:totais-esperados:${month}`;

function parseForm(form: ExpectedForm): ExpectedTotals {
  const expected = emptyExpectedTotals();
  let filled = 0;
  for (const key of METRIC_KEYS) {
    const raw = form[key].trim();
    if (!raw) continue;
    const value = parseValor(raw);
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000) throw new Error(`Informe um valor válido em “${METRICS[key].label}”.`);
    expected[key] = value;
    filled++;
  }
  if (!filled) throw new Error("Preencha pelo menos um total esperado para comparar.");
  return expected;
}

function inputValue(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace(".", ",");
}

function Conferencia() {
  const month = useMonth();
  return <ConferenciaMonth key={month} month={month} />;
}

function ConferenciaMonth({ month }: { month: string }) {
  const { data: txs = [], isLoading, isError } = useMonthTx(month);
  const { data: settings } = useSettings();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const [form, setForm] = useState<ExpectedForm>(blankForm);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reconcile = useServerFn(reconcileExpectedTotals);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(month));
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      const restored = blankForm();
      for (const key of METRIC_KEYS) {
        const value = (parsed as Record<string, unknown>)[key];
        if (typeof value === "string") restored[key] = value;
      }
      setForm(restored);
    } catch {
      // A unreadable local preference must never block reconciliation.
    }
  }, [month]);

  const actual = useMemo(() => settings ? actualTotals({ txs, month, settings, categories, accounts, today: todayISO() }) : null, [txs, month, settings, categories, accounts]);
  const txById = useMemo(() => new Map(txs.map(tx => [tx.id, tx])), [txs]);

  const clearResult = () => { setResult(null); setAnalysis(null); setAnalysisError(null); };
  const update = (key: MetricKey, value: string) => { setForm(old => ({ ...old, [key]: value })); clearResult(); };
  const fillCurrent = () => {
    if (!actual) return;
    setForm(Object.fromEntries(METRIC_KEYS.map(key => [key, inputValue(actual[key])])) as ExpectedForm);
    clearResult();
  };

  const compare = async () => {
    let expected: ExpectedTotals;
    try { expected = parseForm(form); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Revise os valores informados."); return; }
    if (!actual) return;
    setBusy(true);
    setAnalysis(null);
    setAnalysisError(null);
    const localResult = compareExpectedTotals(month, actual, expected);
    setResult(localResult);
    try { localStorage.setItem(storageKey(month), JSON.stringify(form)); } catch { /* Local persistence is optional. */ }
    if (localResult.divergenceCount === 0) {
      toast.success("Todos os valores informados conferem.");
      setBusy(false);
      return;
    }
    try {
      const response = await reconcile({ data: { month, today: todayISO(), expected } });
      setResult(response.result);
      setAnalysis(response.analysis);
      setAnalysisError(response.analysisError);
      if (response.analysisError) toast.error(response.analysisError);
      else toast.success("Análise de divergências concluída.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir a análise.";
      setAnalysisError(`${message} A comparação numérica calculada nesta tela continua disponível.`);
      toast.error("A IA não respondeu; a comparação numérica continua disponível.");
    } finally { setBusy(false); }
  };

  return <>
    <PageHeader title="Conferência inteligente"><MonthSelector /></PageHeader>
    <div className="mb-5 flex items-start gap-3 rounded-xl border bg-card p-4">
      <Scale className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div><p className="font-semibold">Compare seu relatório com {monthLabel(month)}</p><p className="mt-1 text-sm text-muted-foreground">Preencha só os totais que quer conferir. O app calcula as diferenças; se houver divergência, a IA procura os lançamentos que podem explicá-la. Nada é alterado automaticamente.</p></div>
    </div>

    {isLoading || !settings ? <Loading /> : isError ? <p role="alert">Não foi possível carregar os lançamentos deste mês.</p> : <>
      <form onSubmit={event => { event.preventDefault(); void compare(); }} className="space-y-4">
        {(["Ciclos e guardar", "Jéssica", "Reembolsos"] as const).map(group => <section key={group} className="card-soft p-4">
          <h2 className="mb-3 font-display text-lg font-bold">{group}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {METRIC_KEYS.filter(key => METRICS[key].group === group).map(key => <div key={key} className="space-y-1.5">
              <Label htmlFor={`expected-${key}`}>{METRICS[key].label}</Label>
              <Input id={`expected-${key}`} inputMode="decimal" autoComplete="off" placeholder={actual ? `Atual: ${inputValue(actual[key])}` : "Ex.: 1.234,56"} value={form[key]} onChange={event => update(key, event.target.value)} />
              {actual && <p className="text-xs text-muted-foreground">No app: <span className="tabular">{fmtBRL(actual[key])}</span></p>}
            </div>)}
          </div>
        </section>)}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !actual}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? "Comparando e analisando…" : "Comparar e analisar com IA"}</Button>
          <Button type="button" variant="outline" disabled={busy || !actual} onClick={fillCurrent}>Preencher com valores atuais</Button>
        </div>
        <p className="text-xs text-muted-foreground">Os valores esperados ficam salvos somente neste navegador. Para investigar divergências, descrições, valores, categorias e contas deste mês são enviados à IA.</p>
      </form>

      {result && <section className="mt-8" aria-live="polite">
        <div className="mb-3 flex items-center gap-2">
          {result.divergenceCount === 0 ? <CheckCircle2 className="h-5 w-5 text-income" /> : <AlertTriangle className="h-5 w-5 text-warning-foreground" />}
          <h2 className="font-display text-xl font-bold">{result.divergenceCount === 0 ? "Tudo confere" : `${result.divergenceCount} divergência${result.divergenceCount === 1 ? "" : "s"} encontrada${result.divergenceCount === 1 ? "" : "s"}`}</h2>
        </div>
        <div className="card-soft divide-y px-4">
          {result.comparisons.map(row => <div key={row.key} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{METRICS[row.key].label}</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.matches ? "bg-secondary text-income" : "bg-secondary text-warning-foreground"}`}>{row.matches ? "Confere" : "Divergente"}</span></div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-xs text-muted-foreground">Esperado</p><p className="tabular mt-0.5">{fmtBRL(row.expected)}</p></div>
              <div><p className="text-xs text-muted-foreground">No app</p><p className="tabular mt-0.5">{fmtBRL(row.actual)}</p></div>
              <div><p className="text-xs text-muted-foreground">Diferença</p><p className={`tabular mt-0.5 font-semibold ${row.matches ? "text-income" : "text-expense"}`}>{row.difference > 0 ? "+" : ""}{fmtBRL(row.difference)}</p></div>
            </div>
          </div>)}
        </div>
        {result.divergenceCount === 0 && <p className="mt-3 text-sm text-muted-foreground">Como não há divergências acima do arredondamento para centavos, não foi necessário chamar a IA.</p>}
      </section>}

      {busy && result?.divergenceCount ? <div className="card-soft mt-4 flex items-center gap-3 p-4 text-sm"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span>A IA está relacionando as diferenças aos lançamentos. A comparação acima já está pronta.</span></div> : null}

      {analysisError && !busy && <div role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><p>{analysisError}</p></div><Button className="mt-3" variant="outline" size="sm" onClick={() => void compare()}>Tentar análise novamente</Button></div>}

      {analysis && !busy && <section className="mt-8">
        <div className="mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Análise da IA</h2></div>
        <div className="card-soft p-4"><p className="text-sm leading-6">{analysis.resumo}</p><p className="mt-2 text-xs text-muted-foreground">São hipóteses para revisão, não correções automáticas.</p></div>
        <h3 className="mb-2 mt-5 font-semibold">Itens que podem explicar as divergências</h3>
        {analysis.suspeitas.length === 0 ? <p className="card-soft p-4 text-sm text-muted-foreground">Nenhum lançamento isolado se destacou. Veja as verificações sugeridas abaixo.</p> : <div className="space-y-3">{analysis.suspeitas.map((item, index) => {
          const tx = item.transactionId ? txById.get(item.transactionId) : undefined;
          return <article key={`${item.transactionId ?? "geral"}-${index}`} className="card-soft p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{tx?.descricao || "Hipótese geral"}</p><p className="mt-1 text-xs text-muted-foreground">{item.metricKey ? METRICS[item.metricKey].label : "Mais de um total"}{item.impacto != null ? ` · Impacto estimado: ${fmtBRL(item.impacto)}` : ""}</p></div><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Confiança {item.confianca}</span></div>
            <p className="mt-3 text-sm leading-6">{item.explicacao}</p>
            {tx && <Button className="mt-3" size="sm" variant="outline" onClick={() => openTx({ tx })}>Abrir lançamento</Button>}
          </article>;
        })}</div>}
        {analysis.verificacoes.length > 0 && <div className="card-soft mt-4 p-4"><h3 className="font-semibold">O que conferir agora</h3><ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6">{analysis.verificacoes.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      </section>}
    </>}
  </>;
}
