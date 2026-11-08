import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { buildSeries, dateInMonth, dayOf, todayISO, type Recorrencia, type Tipo, type Tx } from "@/lib/finance";
import { useAccounts, useCategories, useInvalidate, useMonth } from "@/lib/data";

type Open = { tx?: Tx; defaults?: Partial<Tx> } | null;
type FormState = {
  tipo: Tipo; descricao: string; categoria_id: string; valor: string;
  data_vencimento: string; conta_id: string; recorrencia: Recorrencia;
  parcelas_total: number | string; pagas: number | string; ciclo: number | string;
  nao_contabilizar: boolean; reembolso_de: string; recebido: boolean; recebido_em: string;
  bonificacao: boolean; pago: boolean; data_pagamento: string; observacoes: string;
};
let state: Open = null;
const ls = new Set<() => void>();
export const openTx = (o: Open) => ((state = o), ls.forEach((l) => l()));
const useOpen = () => useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => state, () => null);

const sel = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function TxFormHost() {
  const open = useOpen();
  const month = useMonth();
  const { data: cats = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const inv = useInvalidate();
  const tx = open?.tx;
  const [f, setF] = useState<FormState>({
    tipo: "saida", descricao: "", categoria_id: "", valor: "", data_vencimento: "",
    conta_id: "", recorrencia: "unica", parcelas_total: 2, pagas: 0,
    nao_contabilizar: false, reembolso_de: "", recebido: false, recebido_em: "",
    ciclo: 1, bonificacao: false, pago: false, data_pagamento: "", observacoes: "",
  });
  const [scope, setScope] = useState<"one" | "fwd">("one");

  useEffect(() => {
    if (!open) return;
    const d = { ...open.defaults, ...tx };
    setScope("one");
    setF({
      tipo: d.tipo ?? "saida",
      descricao: d.descricao ?? "",
      categoria_id: d.categoria_id ?? "",
      valor: d.valor != null ? String(d.valor).replace(".", ",") : "",
      data_vencimento: d.data_vencimento ?? (todayISO().startsWith(month) ? todayISO() : dateInMonth(month, 1)),
      conta_id: d.conta_id ?? accounts.find(a => a.ativo && a.tipo === "conta_corrente")?.id ?? accounts.find(a => a.ativo)?.id ?? "",
      recorrencia: d.recorrencia ?? "unica",
      parcelas_total: d.parcelas_total ?? 2,
      pagas: 0,
      ciclo: d.ciclo ?? 1,
      bonificacao: d.bonificacao ?? false,
      pago: d.pago ?? false,
      data_pagamento: d.data_pagamento ?? "",
      observacoes: d.observacoes ?? "",
      nao_contabilizar: d.nao_contabilizar ?? false, reembolso_de: d.reembolso_de ?? "", recebido: d.recebido ?? false, recebido_em: d.recebido_em ?? "",
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const close = () => openTx(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = Number(String(f.valor).replace(/\./g, "").replace(",", "."));
    if (!f.descricao && f.categoria_id === "") { toast.error("Informe a descrição."); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Valor inválido."); return; }
    const common = {
      tipo: f.tipo as Tipo,
      descricao: f.descricao,
      categoria_id: f.categoria_id || null,
      valor,
      conta_id: f.conta_id || null,
      nao_contabilizar: f.nao_contabilizar, reembolso_de: f.nao_contabilizar ? f.reembolso_de || null : null, recebido: f.recebido, recebido_em: f.recebido ? f.recebido_em || todayISO() : null,
      bonificacao: f.tipo === "entrada" && f.bonificacao,
      observacoes: f.observacoes || null,
    };
    const ciclo = f.tipo === "entrada" ? Number(f.ciclo) : null;
    try {
      if (tx) {
        const one = { ...common, data_vencimento: f.data_vencimento, pago: f.pago, data_pagamento: f.pago ? f.data_pagamento || todayISO() : null, ...(ciclo ? { ciclo } : {}) };
        let r = await supabase.from("transactions").update(one).eq("id", tx.id);
        if (r.error) throw r.error;
        if (scope === "fwd" && tx.grupo_id) {
          const { data: rows, error } = await supabase.from("transactions").select("id,data_vencimento").eq("grupo_id", tx.grupo_id).gt("data_vencimento", tx.data_vencimento);
          if (error) throw error;
          const day = dayOf(f.data_vencimento);
          for (const row of rows) {
            r = await supabase.from("transactions").update({ ...common, data_vencimento: dateInMonth(row.data_vencimento.slice(0, 7), day), ...(ciclo ? { ciclo } : {}) }).eq("id", row.id);
            if (r.error) throw r.error;
          }
        }
      } else {
        const rows = buildSeries(
          { ...common, data_vencimento: f.data_vencimento, recorrencia: f.recorrencia as Recorrencia, pago: f.pago, data_pagamento: f.pago ? f.data_pagamento || todayISO() : null, ciclo },
          { parcelasTotal: Number(f.parcelas_total), parcelasPagas: Number(f.pagas) },
          crypto.randomUUID(),
        );
        const r = await supabase.from("transactions").insert(rows);
        if (r.error) throw r.error;
      }
      toast.success("Lançamento salvo");
      inv();
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  };

  const remove = async () => {
    if (!tx) return;
    const grupoId = tx.grupo_id;
    const fwd = scope === "fwd" && grupoId;
    if (!confirm(fwd ? "Excluir este e os próximos lançamentos?" : "Excluir este lançamento?")) return;
    let r;
    if (fwd && grupoId) {
      r = await supabase.from("transactions").delete().eq("grupo_id", grupoId).gte("data_vencimento", tx.data_vencimento);
      await supabase.from("transactions").update({ encerrada: true }).eq("grupo_id", grupoId);
    } else r = await supabase.from("transactions").delete().eq("id", tx.id);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success("Excluído");
    inv();
    close();
  };

  const recurring = tx && tx.recorrencia !== "unica";

  return (
    <Dialog open={!!open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{tx ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["saida", "entrada"] as const).map((t) => (
              <Button key={t} type="button" variant={f.tipo === t ? "default" : "outline"} onClick={() => set("tipo", t)}>
                {t === "saida" ? "Saída" : "Entrada"}
              </Button>
            ))}
          </div>
          <div className="space-y-1"><Label>Descrição</Label><Input value={f.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Valor (R$)</Label><Input inputMode="decimal" value={f.valor ?? ""} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" /></div>
            <div className="space-y-1"><Label>{f.nao_contabilizar ? "Data prevista" : "Vencimento"}</Label><Input required type="date" value={f.data_vencimento ?? ""} onChange={(e) => set("data_vencimento", e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <select className={sel} value={f.categoria_id ?? ""} onChange={(e) => set("categoria_id", e.target.value)}>
              <option value="">Sem categoria</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Forma de pagamento</Label>
            <select className={sel} value={f.conta_id} onChange={(e) => set("conta_id", e.target.value)}>
              <option value="">Selecione uma conta</option>{accounts.filter(a => a.ativo || a.id === f.conta_id).map(a => <option key={a.id} value={a.id}>{a.nome}{!a.ativo ? " (arquivada)" : ""}</option>)}
            </select>
          </div>
          {f.tipo === "entrada" && (
            <div className="grid grid-cols-2 items-end gap-2">
              <div className="space-y-1"><Label>Ciclo</Label>
                <select className={sel} value={f.ciclo} onChange={(e) => set("ciclo", e.target.value)}><option value={1}>Ciclo 1</option><option value={2}>Ciclo 2</option></select>
              </div>
              <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={f.bonificacao} onChange={(e) => set("bonificacao", e.target.checked)} /> Bonificação</label>
            </div>
          )}
          {!tx && (
            <div className="space-y-1">
              <Label>Recorrência</Label>
              <select className={sel} value={f.recorrencia} onChange={(e) => set("recorrencia", e.target.value as Recorrencia)}>
                <option value="unica">Única</option><option value="fixa">Fixa (todo mês)</option><option value="parcelada">Parcelada</option>
              </select>
            </div>
          )}
          {!tx && f.recorrencia === "parcelada" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Nº de parcelas</Label><Input type="number" min={1} value={f.parcelas_total} onChange={(e) => set("parcelas_total", e.target.value)} /></div>
              <div className="space-y-1"><Label>Já pagas</Label><Input type="number" min={0} value={f.pagas} onChange={(e) => set("pagas", e.target.value)} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 items-end gap-2">
            <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={f.pago ?? false} onChange={(e) => set("pago", e.target.checked)} /> Pago</label>
            {f.pago && <div className="space-y-1"><Label>Data pagamento</Label><Input type="date" value={f.data_pagamento || todayISO()} onChange={(e) => set("data_pagamento", e.target.value)} /></div>}
          </div>
          <div className="space-y-1"><Label>Anotações</Label><Textarea value={f.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></div>
          <label className="flex items-center gap-3 text-sm"><Switch checked={f.nao_contabilizar} onCheckedChange={v => set("nao_contabilizar", v)} />Não contabilizar nas minhas contas (vou ser reembolsado)</label>
          {f.nao_contabilizar && <div className="space-y-3">
            <div><Label>Quem reembolsa</Label><Input value={f.reembolso_de} onChange={e => set("reembolso_de",e.target.value)} /></div>
            <p className="text-sm text-muted-foreground">Data prevista: {f.data_vencimento.split("-").reverse().join("/")}</p>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.recebido} onChange={e => set("recebido",e.target.checked)} />Recebido</label>
            {f.recebido && <Input aria-label="Recebido em" type="date" value={f.recebido_em || todayISO()} onChange={e => set("recebido_em",e.target.value)} />}
          </div>}
          {recurring && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="mb-2 font-medium">Aplicar alterações a:</p>
              <label className="mr-4"><input type="radio" checked={scope === "one"} onChange={() => setScope("one")} /> Só este mês</label>
              <label><input type="radio" checked={scope === "fwd"} onChange={() => setScope("fwd")} /> Este e os próximos</label>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            {tx && <Button type="button" variant="destructive" onClick={remove}>Excluir</Button>}
            <Button type="submit" className="flex-1">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
