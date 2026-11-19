import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, monthEnd, monthKey, monthStart, type Account, type Category, type Settings, type Tx } from "./finance";

// ---------- selected month (shared across screens) ----------
let current = (() => {
  const d = new Date();
  return monthKey(d.getFullYear(), d.getMonth() + 1);
})();
const listeners = new Set<() => void>();
export const setMonth = (k: string) => {
  current = k;
  listeners.forEach((l) => l());
};
export const useMonth = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
    () => current,
  );

// ---------- queries ----------
const num = (v: unknown) => (v == null ? null : Number(v));

export const useSettings = () =>
  useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      if (!data) {
        const ins = await supabase.from("settings").insert({}).select("*").single();
        if (ins.error) throw ins.error;
        return normSettings(ins.data);
      }
      return normSettings(data);
    },
  });
const normSettings = (d: Record<string, unknown>): Settings => ({
  orcamento_mercado: Number(d["orcamento_mercado"]),
  lazer_por_ciclo: Number(d["lazer_por_ciclo"]),
  dia_corte_ciclo: Number(d["dia_corte_ciclo"]),
  dia_fechamento_cartao: Number(d["dia_fechamento_cartao"]),
});

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").order("nome");
      if (error) throw error;
      return data.map((c) => ({ ...c, orcamento_mensal: num(c.orcamento_mensal) }));
    },
  });

export const normTx = (t: Record<string, unknown>) => ({ ...t, responsavel: t["responsavel"] ?? "Felipe", valor: Number(t["valor"]) }) as Tx;

/** Transactions from `from` month to `to` month inclusive. Extends fixed bills first. */
export const useTransactions = (from: string, to: string) =>
  useQuery({
    queryKey: ["tx", from, to],
    queryFn: async (): Promise<Tx[]> => {
      const extended = await supabase.rpc("ensure_fixed", { p_until: monthEnd(to) });
      if (extended.error) throw extended.error;
      const all: Tx[] = [];
      for (let page = 0; ; page++) {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .gte("data_vencimento", monthStart(from))
          .lte("data_vencimento", monthEnd(to))
          .order("data_vencimento")
          .order("descricao")
          .order("id")
          .range(page * 1000, page * 1000 + 999);
        if (error) throw error;
        all.push(...data.map(normTx));
        if (data.length < 1000) break;
      }
      return all;
    },
  });
export const useMonthTx = (k: string) => useTransactions(k, k);
export const useLastMonths = (k: string, n: number) => useTransactions(addMonths(k, -(n - 1)), k);

export const useInvalidate = () => {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["tx"] }), qc.invalidateQueries({ queryKey: ["provisions"] })]);
};

export const useTogglePaid = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, pago, data }: { id: string; pago: boolean; data?: string | null }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ pago, data_pagamento: pago ? (data ?? new Date().toISOString().slice(0, 10)) : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
};

export const useAccounts = () => useQuery({queryKey:["accounts"],queryFn:async ():Promise<Account[]> => {
  const {data,error}=await supabase.from("accounts").select("*").order("ordem").order("nome");
  if(error) throw error;
  return data.map(a=>({...a,tipo:a.tipo as Account["tipo"],limite:num(a.limite)}));
}});
export const useAllTransactions = () => useQuery({queryKey:["tx","all"],queryFn:async ():Promise<Tx[]> => {
  const all:Tx[]=[];
  for(let p=0;;p++) {
    const {data,error}=await supabase.from("transactions").select("*").order("data_vencimento").order("id").range(p*1000,p*1000+999);
    if(error) throw error;
    all.push(...data.map(normTx)); if(data.length<1000) break;
  }
  return all;
}});
export const useReceivables = () => useQuery({queryKey:["tx","receivables"],queryFn:async ():Promise<Tx[]> => {
  const all:Tx[]=[];
  for(let p=0;;p++) {
    const {data,error}=await supabase.from("transactions").select("*").eq("nao_contabilizar",true).eq("responsavel","Felipe").order("data_vencimento").order("id").range(p*1000,p*1000+999);
    if(error) throw error;
    all.push(...data.map(normTx)); if(data.length<1000) break;
  }
  return all;
}});
