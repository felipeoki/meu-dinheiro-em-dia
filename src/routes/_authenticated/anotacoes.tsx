import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useMonth, useReceivables } from "@/lib/data";
import { fmtBRL, fmtDate, sum, todayISO } from "@/lib/finance";
import { openTx } from "@/components/app/TxForm";
import { Loading, MonthSelector, PageHeader } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReceiptPdfButton } from '@/components/app/ReceiptPdfButton';

export const Route = createFileRoute("/_authenticated/anotacoes")({head:()=>({meta:[{title:"Anotações — Finanças Pessoais"},{name:"description",content:"Valores a receber e notas pessoais."},{property:"og:title",content:"Anotações — Finanças Pessoais"},{property:"og:description",content:"Valores a receber e notas pessoais."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Anotacoes});
type Note = {id:string;titulo:string;texto:string;mes:string|null};
function Anotacoes() {
  const [tab,setTab]=useState("receber");
  const {data:txs=[],isLoading}=useReceivables();
  const inv=useInvalidate(); const qc=useQueryClient(); const month=useMonth();
  const {data:notes=[]}=useQuery({queryKey:["notes"],queryFn:async()=>{const all:Note[]=[];for(let p=0;;p++){const r=await supabase.from("notes").select("*").order("created_at",{ascending:false}).order("id").range(p*1000,p*1000+999);if(r.error)throw r.error;all.push(...r.data);if(r.data.length<1000)break;}return all;}});
  const [edit,setEdit]=useState<Note|null>(null);
  const updateReceived=async(id:string,received:boolean,date?:string)=>{const r=await supabase.from("transactions").update({recebido:received,recebido_em:received ? date || todayISO() : null}).eq("id",id);if(r.error)toast.error(r.error.message);else inv();};
  const saveNote=async(e:React.FormEvent)=>{e.preventDefault();if(!edit)return;const v={titulo:edit.titulo,texto:edit.texto,mes:edit.mes};const r=edit.id ? await supabase.from("notes").update(v).eq("id",edit.id) : await supabase.from("notes").insert(v);if(r.error)toast.error(r.error.message);else {qc.invalidateQueries({queryKey:["notes"]});setEdit(null);}};
  const deleteNote=async(n:Note)=>{if(!confirm(`Excluir a nota “${n.titulo}”?`))return;const r=await supabase.from("notes").delete().eq("id",n.id);if(r.error)toast.error(r.error.message);else qc.invalidateQueries({queryKey:["notes"]});};
  const people=[...new Set(txs.map(t=>t.reembolso_de || "Não informado"))];
  return <><PageHeader title="Anotações"><MonthSelector /></PageHeader><div className="mb-5 flex gap-2"><Button variant={tab==="receber"?"default":"outline"} onClick={()=>setTab("receber")}>A receber</Button><Button variant={tab==="notas"?"default":"outline"} onClick={()=>setTab("notas")}>Notas livres</Button></div>
  {tab==="receber" ? <><div className="mb-4"><ReceiptPdfButton month={month} /></div><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">Total pendente: {fmtBRL(sum(txs.filter(t=>!t.recebido)))}</p><Button onClick={()=>openTx({defaults:{nao_contabilizar:true,reembolso_de:"Time"}})}>+ Novo valor a receber</Button></div>{isLoading?<Loading/>:people.length===0?<p className="text-muted-foreground">Nenhum valor a receber.</p>:people.map(person=>{const rows=txs.filter(t=>(t.reembolso_de || "Não informado")===person);return <section key={person} className="mb-6"><h2 className="mb-2 flex justify-between font-semibold"><span>{person}</span><span>{fmtBRL(sum(rows.filter(t=>!t.recebido)))}</span></h2><div className="divide-y border-y">{rows.map(t=><div key={t.id} className="flex flex-wrap items-center gap-3 py-3"><Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left" onClick={()=>openTx({tx:t})}>{t.descricao} · {fmtDate(t.data_vencimento)}</Button><span className="tabular text-muted-foreground">{fmtBRL(t.valor)}</span><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={t.recebido} onChange={e=>updateReceived(t.id,e.target.checked)}/>Recebido</label>{t.recebido && <Input aria-label="Recebido em" className="w-40" type="date" value={t.recebido_em ?? todayISO()} onChange={e=>updateReceived(t.id,true,e.target.value)}/>}</div>)}</div></section>;})}</> : <><Button className="mb-4" onClick={()=>setEdit({id:"",titulo:"",texto:"",mes:`${month}-01`})}>+ Nova nota</Button><div className="grid gap-3 md:grid-cols-2">{notes.map(n=><article key={n.id} className="rounded-lg border bg-card p-4"><h2 className="font-semibold">{n.titulo}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm">{n.texto}</p><p className="my-2 text-xs text-muted-foreground">{n.mes ? fmtDate(n.mes) : "Sem mês"}</p><Button variant="outline" size="sm" onClick={()=>setEdit(n)}>Editar nota</Button><Button variant="ghost" size="sm" onClick={()=>deleteNote(n)}>Excluir nota</Button></article>)}</div></>}
  <Dialog open={edit!==null} onOpenChange={o=>!o && setEdit(null)}><DialogContent><DialogHeader><DialogTitle>{edit?.id ? "Editar nota" : "Nova nota"}</DialogTitle></DialogHeader>{edit && <form onSubmit={saveNote} className="space-y-3"><Input aria-label="Título" required placeholder="Título" value={edit.titulo} onChange={e=>setEdit({...edit,titulo:e.target.value})}/><Textarea aria-label="Texto" rows={7} value={edit.texto} onChange={e=>setEdit({...edit,texto:e.target.value})}/><Input aria-label="Mês da nota" type="month" value={edit.mes?.slice(0,7) ?? ""} onChange={e=>setEdit({...edit,mes:e.target.value ? `${e.target.value}-01` : null})}/><Button type="submit">Salvar nota</Button></form>}</DialogContent></Dialog></>;
}