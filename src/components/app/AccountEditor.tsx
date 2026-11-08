import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { type Account, parseValor } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AccountEditor({ account, accounts, close }: { account: Account | null; accounts: Account[]; close: () => void }) {
  const qc = useQueryClient();
  const [nome,setNome] = useState(account?.nome ?? "");
  const [tipo,setTipo] = useState<Account["tipo"]>(account?.tipo ?? "cartao_credito");
  const [cor,setCor] = useState(account?.cor ?? accounts[0]?.cor ?? "");
  const [fech,setFech] = useState(String(account?.dia_fechamento ?? ""));
  const [venc,setVenc] = useState(String(account?.dia_vencimento ?? ""));
  const [limite,setLimite] = useState(String(account?.limite ?? ""));
  const [removing,setRemoving] = useState(false);
  const [target,setTarget] = useState("");
  const [busy,setBusy] = useState(false);
  const refresh = () => { qc.invalidateQueries({queryKey:["accounts"]}); qc.invalidateQueries({queryKey:["tx"]}); close(); };
  const save = async (e:React.FormEvent) => {
    e.preventDefault(); if (!nome.trim()) return;
    if (limite && (!Number.isFinite(parseValor(limite)) || parseValor(limite)<0)) {toast.error("Limite inválido");return;}
    setBusy(true);
    const value = {nome:nome.trim(),tipo,...(cor ? {cor} : {}),dia_fechamento:fech ? Number(fech) : null,dia_vencimento:venc ? Number(venc) : null,limite:limite ? parseValor(limite) : null,ordem:account?.ordem ?? accounts.length};
    const r = account ? await supabase.from("accounts").update(value).eq("id",account.id) : await supabase.from("accounts").insert(value);
    setBusy(false); if(r.error) toast.error(r.error.message); else {toast.success("Conta salva");refresh();}
  };
  const remove = async (move:boolean) => {
    if(!account || (move && !target)) return;
    setBusy(true);
    if(move) {
      const r=await supabase.from("transactions").update({conta_id:target}).eq("conta_id",account.id);
      if(r.error) {toast.error(r.error.message);setBusy(false);return;}
    }
    const r=await supabase.from("accounts").update({ativo:false}).eq("id",account.id);
    setBusy(false); if(r.error) toast.error(r.error.message);else refresh();
  };
  return <Dialog open onOpenChange={o => !o && close()}><DialogContent className="max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>{account ? "Editar cartão ou conta" : "Novo cartão ou conta"}</DialogTitle></DialogHeader>
    {removing ? <div className="space-y-4"><p>Arquivar esta conta mantém todos os lançamentos. Você também pode movê-los para outra conta.</p><select aria-label="Mover para conta" className="h-10 w-full rounded-md border bg-card px-3" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Escolha outra conta</option>{accounts.filter(a=>a.ativo && a.id!==account?.id).map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select><Button disabled={busy || !target} onClick={()=>remove(true)}>Mover e arquivar</Button><Button disabled={busy} variant="outline" onClick={()=>remove(false)}>Apenas arquivar</Button></div> :
    <form onSubmit={save} className="space-y-3"><Label>Nome<Input required value={nome} onChange={e=>setNome(e.target.value)} /></Label><Label>Tipo<select className="h-10 w-full rounded-md border bg-card px-3" value={tipo} onChange={e=>setTipo(e.target.value as Account["tipo"])}><option value="cartao_credito">Cartão de crédito</option><option value="conta_corrente">Conta corrente</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option></select></Label><Label>Cor<Input type="color" value={cor} onChange={e=>setCor(e.target.value)} /></Label>
    {tipo === "cartao_credito" && <div className="grid grid-cols-2 gap-3"><Label>Fechamento<Input type="number" min={1} max={31} value={fech} onChange={e=>setFech(e.target.value)} /></Label><Label>Vencimento<Input type="number" min={1} max={31} value={venc} onChange={e=>setVenc(e.target.value)} /></Label><Label className="col-span-2">Limite (R$)<Input value={limite} onChange={e=>setLimite(e.target.value)} /></Label></div>}
    <div className="flex gap-2">{account && <Button type="button" variant="destructive" onClick={()=>setRemoving(true)}>Remover conta</Button>}<Button disabled={busy} type="submit">Salvar conta</Button></div></form>}
  </DialogContent></Dialog>;
}