import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, Pencil, Plus } from "lucide-react";
import { addMonths, faturaMonth, fmtBRL, fmtDate, invoicePartition, parcelaLabel, sum, type Account } from "@/lib/finance";
import { useAccounts, useMonth, useSettings, useAllTransactions } from "@/lib/data";
import { Empty, Loading, MonthSelector, PageHeader, Stat } from "@/components/app/ui";
import { openTx } from "@/components/app/TxForm";
import { AccountEditor } from "@/components/app/AccountEditor";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/cartoes")({head:()=>({meta:[{title:"Cartões e contas — Finanças Pessoais"},{name:"description",content:"Faturas, limites e contas editáveis."},{property:"og:title",content:"Cartões e contas — Finanças Pessoais"},{property:"og:description",content:"Faturas, limites e contas editáveis."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Cartoes});
function Cartoes(){
  const m=useMonth(); const {data:accounts=[]}=useAccounts(); const {data:s}=useSettings();
  const {data:txs=[],isLoading}=useAllTransactions();
  const [selected,setSelected]=useState(""); const [editing,setEditing]=useState<Account|null|undefined>(undefined);
  const cards=accounts.filter(a=>a.ativo && a.tipo==="cartao_credito");
  const card=cards.find(a=>a.id===selected) ?? cards[0];
  const fech=card?.dia_fechamento ?? s?.dia_fechamento_cartao ?? 26;
  const items=txs.filter(t=>t.conta_id===card?.id && t.tipo==="saida" && faturaMonth(t.data_vencimento,fech)===m);
  const totals=invoicePartition(items);
  const used=sum(txs.filter(t=>t.conta_id===card?.id && t.tipo==="saida" && !t.pago && faturaMonth(t.data_vencimento,fech)>=m));
  return <><PageHeader title="Cartões e contas"><MonthSelector/></PageHeader><div className="mb-4 flex flex-wrap gap-2">{cards.map(a=><Button key={a.id} variant={card?.id===a.id?"default":"outline"} onClick={()=>setSelected(a.id)}>{a.nome}</Button>)}<Button variant="outline" onClick={()=>setEditing(null)}><Plus/>Novo cartão ou conta</Button></div>
    {card && <><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{card.nome} · fecha dia {fech} · vence {card.dia_vencimento ? `dia ${card.dia_vencimento}` : "não definido"}</p><Button size="icon" variant="ghost" title="Editar cartão" aria-label="Editar cartão" onClick={()=>setEditing(card)}><Pencil/></Button></div><div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Total da fatura" value={fmtBRL(totals.total)}/><Stat label="Minha parte (Felipe)" value={fmtBRL(totals.felipe)}/><Stat label="Jéssica" value={fmtBRL(totals.jessica)}/><Stat label="A receber da empresa (não contabilizado)" value={fmtBRL(totals.empresa)}/></div>{card.limite!=null && <p className="mb-4 text-sm">Limite: {fmtBRL(card.limite)} · Usado: {fmtBRL(used)} · Disponível: {fmtBRL(card.limite-used)}</p>}<Button className="mb-4" onClick={()=>openTx({defaults:{conta_id:card.id}})}><Plus/>Nova compra neste cartão</Button></>}
    {isLoading ? <Loading/> : !card || items.length===0 ? <Empty icon={<CreditCard className="h-8 w-8"/>} title="Fatura vazia"/> : <div className="divide-y border-y">{items.map(t=><Button key={t.id} variant="ghost" onClick={()=>openTx({tx:t})} className="flex h-auto w-full items-center justify-between gap-3 rounded-none py-3 text-left"><span className="min-w-0 whitespace-normal">{t.descricao}<span className="block text-xs text-muted-foreground">{parcelaLabel(t)} · {fmtDate(t.data_vencimento)}</span>{t.responsavel === "Jéssica" && <span className="mr-2 text-xs text-responsible">Jéssica</span>}{t.nao_contabilizar && <span className="text-xs text-warning-foreground">{t.recebido?"Recebido":"A receber"}</span>}</span><span title={t.responsavel === "Jéssica" ? "Não entra nas minhas contas" : undefined} className={t.nao_contabilizar || t.responsavel === "Jéssica" ? "tabular text-muted-foreground" : "tabular text-expense"}>{fmtBRL(t.valor)}</span></Button>)}</div>}
    <h2 className="mb-2 mt-6 font-semibold">Todas as contas</h2><div className="divide-y border-y">{accounts.map(a=><div key={a.id} className="flex items-center justify-between gap-3 py-3"><span>{a.nome}<span className="ml-2 text-xs text-muted-foreground">{a.ativo ? a.tipo.replaceAll("_"," ") : "Arquivada"}</span></span><Button variant="ghost" size="icon" title={`Editar ${a.nome}`} aria-label={`Editar ${a.nome}`} onClick={()=>setEditing(a)}><Pencil/></Button></div>)}</div>{editing!==undefined && <AccountEditor key={editing?.id ?? "new"} account={editing} accounts={accounts} close={()=>setEditing(undefined)}/>}</>;
}
