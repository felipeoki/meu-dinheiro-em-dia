import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { buildSeries, fmtDate, parcelaLabel, parseData, parseValor, type Category } from "@/lib/finance";
import { useCategories, useInvalidate, useMonth, useMonthTx, useSettings } from "@/lib/data";
import { MonthSelector, PageHeader } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({ meta: [{ title: "Mais — Finanças Pessoais" }, { name: "description", content: "Categorias, configurações, importar e exportar." }, { property: "og:title", content: "Mais — Finanças Pessoais" }, { property: "og:description", content: "Categorias, configurações, importar e exportar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Mais,
});

function Mais() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const out = async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); };
  return (
    <>
      <PageHeader title="Mais"><MonthSelector /></PageHeader>
      <div className="space-y-4">
        <SettingsCard />
        <CategoriesCard />
        <ImportExport />
        <Button variant="outline" className="w-full md:hidden" onClick={out}>Sair</Button>
      </div>
    </>
  );
}

function SettingsCard() {
  const { data: s } = useSettings();
  const qc = useQueryClient();
  const [f, setF] = useState(s);
  useEffect(() => setF(s), [s]);
  if (!f) return null;
  const save = async () => {
    const { error } = await supabase.from("settings").update(f).neq("user_id", "00000000-0000-0000-0000-000000000000");
    if (error) { toast.error(error.message); return; }
    toast.success("Configurações salvas");
    qc.invalidateQueries();
  };
  const field = (k: keyof typeof f, l: string) => (
    <div className="space-y-1"><Label>{l}</Label><Input type="number" value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></div>
  );
  return (
    <div className="card-soft space-y-3 p-4">
      <h2 className="font-display font-bold">Configurações</h2>
      <div className="grid grid-cols-2 gap-3">
        {field("orcamento_mercado", "Orçamento mercado")}
        {field("lazer_por_ciclo", "Lazer por ciclo")}
        {field("dia_corte_ciclo", "Dia de corte do ciclo")}
        {field("dia_fechamento_cartao", "Fechamento do cartão")}
      </div>
      <Button onClick={save}>Salvar</Button>
    </div>
  );
}

function CategoriesCard() {
  const { data: cats = [] } = useCategories();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["categories"] });
  const upd = async (c: Category, patch: Partial<Category>) => {
    const { error } = await supabase.from("categories").update(patch).eq("id", c.id);
    if (error) toast.error(error.message); else refresh();
  };
  const add = async () => {
    const nome = prompt("Nome da nova categoria");
    if (!nome) return;
    const { error } = await supabase.from("categories").insert({ nome });
    if (error) toast.error(error.message); else refresh();
  };
  const del = async (c: Category) => {
    if (!confirm(`Excluir a categoria "${c.nome}"? Os lançamentos ficarão sem categoria.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) toast.error(error.message); else refresh();
  };
  return (
    <div className="card-soft p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display font-bold">Categorias</h2><Button size="sm" onClick={add}>+ Nova</Button></div>
      <div className="divide-y">
        {cats.map((c) => (
          <div key={c.id} className="flex items-center gap-2 py-2">
            <input type="color" aria-label="Cor" value={c.cor} onChange={(e) => upd(c, { cor: e.target.value })} className="h-8 w-8 shrink-0 cursor-pointer rounded" />
            <Input defaultValue={c.nome} onBlur={(e) => e.target.value !== c.nome && upd(c, { nome: e.target.value })} />
            <Input className="w-28" placeholder="Orçamento" inputMode="decimal" defaultValue={c.orcamento_mensal ?? ""} onBlur={(e) => upd(c, { orcamento_mensal: e.target.value ? parseValor(e.target.value) : null })} />
            <Button variant="ghost" size="sm" onClick={() => del(c)}>✕</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportExport() {
  const m = useMonth();
  const { data: txs = [] } = useMonthTx(m);
  const { data: cats = [] } = useCategories();
  const inv = useInvalidate();
  const exportCsv = () => {
    const rows = [["vencimento", "tipo", "descricao", "categoria", "valor", "parcela", "forma", "pago"]];
    txs.forEach((t) => rows.push([fmtDate(t.data_vencimento), t.tipo, t.descricao, cats.find((c) => c.id === t.categoria_id)?.nome ?? "", String(t.valor).replace(".", ","), parcelaLabel(t), t.forma_pagamento, t.pago ? "sim" : "não"]));
    const csv = "\ufeff" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `lancamentos-${m}.csv`;
    a.click();
  };
  const importFile = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = wb.SheetNames[0];
    const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
    if (!sheet) { toast.error("Nenhuma linha válida encontrada."); return; }
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const all: ReturnType<typeof buildSeries> = [];
    let skipped = 0;
    for (const raw of data) {
      const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase().trim(), v]));
      const venc = parseData(r["vencimento"], m);
      const valor = parseValor(r["valor"]);
      if (!venc || !Number.isFinite(valor)) { skipped++; continue; }
      const p = String(r["parcelas"] ?? "").trim().toLowerCase();
      const n = Number(p);
      const rec = p.startsWith("fix") ? "fixa" : n > 1 ? "parcelada" : "unica";
      all.push(...buildSeries({ tipo: "saida", descricao: String(r["descricao"] ?? ""), categoria_id: null, valor, data_vencimento: venc, pago: false, data_pagamento: null, forma_pagamento: "Conta", recorrencia: rec, bonificacao: false, observacoes: null }, { parcelasTotal: n }, crypto.randomUUID()));
    }
    if (!all.length) { toast.error("Nenhuma linha válida encontrada."); return; }
    const { error } = await supabase.from("transactions").insert(all);
    if (error) { toast.error(error.message); return; }
    toast.success(`Importado! ${all.length} lançamento(s)${skipped ? `, ${skipped} linha(s) ignorada(s)` : ""}.`);
    inv();
  };
  return (
    <div className="card-soft space-y-3 p-4">
      <h2 className="font-display font-bold">Importar / Exportar</h2>
      <p className="text-sm text-muted-foreground">Colunas: vencimento, descricao, valor, parcelas (número ou “Fixo”).</p>
      <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
      <Button variant="outline" onClick={exportCsv}>Exportar CSV do mês</Button>
    </div>
  );
}
