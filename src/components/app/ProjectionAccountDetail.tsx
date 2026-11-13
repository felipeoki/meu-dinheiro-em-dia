import { useState } from "react";
import { Button } from "@/components/ui/button";
import { openTx } from "./TxForm";
import { fmtBRL, monthShort, projection, type Account, type Category, type Settings, type Tx } from "@/lib/finance";

export function ProjectionAccountDetail({ txs, start, horizon, settings, marketId, categories, accounts }: {
  txs: Tx[]; start: string; horizon: number; settings: Settings; marketId: string | null; categories: Category[]; accounts: Account[];
}) {
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const filtered = txs.filter(t => (!category || t.categoria_id === category) && (!account || t.conta_id === account));
  const detail = projection(filtered, start, horizon, { ...settings, orcamento_mercado: (category && category !== marketId) || account ? 0 : settings.orcamento_mercado }, marketId);
  return <details className="min-w-0 border-y py-4">
    <summary className="cursor-pointer font-semibold">Detalhe por conta</summary>
    <div className="mt-4 flex flex-wrap gap-2">
      <select aria-label="Categoria da projeção" className="h-10 w-full min-w-0 rounded-md border bg-card px-3 sm:w-auto" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
      <select aria-label="Conta da projeção" className="h-10 w-full min-w-0 rounded-md border bg-card px-3 sm:w-auto" value={account} onChange={e => setAccount(e.target.value)}><option value="">Todas as contas</option>{accounts.filter(a => a.ativo).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
    </div>
    <div className="mt-4 max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela detalhada por conta">
      <table className="w-full border-collapse text-sm"><thead><tr><th className="sticky left-0 z-10 min-w-48 bg-card p-3 text-left">Conta</th>{detail.months.map(k => <th key={k} className="min-w-32 p-3 text-right">{monthShort(k)}</th>)}</tr></thead>
        <tbody>{detail.rows.map(r => <tr key={r.id} className="border-t"><th className="sticky left-0 z-10 max-w-56 bg-card p-3 text-left"><Button className="h-auto max-w-48 justify-start whitespace-normal p-0 text-left" variant="ghost" onClick={() => openTx({ tx: r.tx })}>{r.tx.descricao}</Button><span className="block text-xs font-normal text-muted-foreground">{r.end ? `restam ${r.remaining} parcelas` : "Fixo"}</span></th>{r.values.map((v, i) => <td key={detail.months[i]} className="tabular p-3 text-right">{v ? fmtBRL(v) : "—"}{detail.months[i] === r.end && <span className="block text-xs text-warning-foreground">termina</span>}</td>)}</tr>)}
          <tr className="border-t"><th className="sticky left-0 bg-card p-3 text-left">Mercado Mensal</th>{detail.totals.map(t => <td key={t.mes} className="tabular p-3 text-right">{fmtBRL(t.mercado)}</td>)}</tr></tbody>
        <tfoot>{([["saidas", "Total de saídas"], ["entradas", "Entradas"], ["saldo", "Saldo previsto"]] as const).map(([key, label]) => <tr key={key} className="border-t font-semibold"><th className="sticky left-0 bg-card p-3 text-left">{label}</th>{detail.totals.map(t => <td key={t.mes} className="tabular p-3 text-right">{fmtBRL(t[key])}</td>)}</tr>)}</tfoot>
      </table>
    </div>
  </details>;
}