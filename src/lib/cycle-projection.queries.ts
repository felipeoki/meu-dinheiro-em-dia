import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normTx } from "./data";
import { monthEnd, type Tx } from "./finance";

/** Projection reads never call ensure_fixed or write finance rows. */
export const projectionTransactionsQuery = (through: string) => queryOptions({
  queryKey: ["projection-transactions", through],
  queryFn: async (): Promise<Tx[]> => {
    const rows: Tx[] = [];
    for (let page = 0; ; page++) {
      const { data, error } = await supabase.from("transactions").select("*").lte("data_vencimento", monthEnd(through))
        .order("data_vencimento").order("descricao").order("id").range(page * 1000, page * 1000 + 999);
      if (error) throw error;
      rows.push(...data.map(normTx));
      if (data.length < 1000) return rows;
    }
  },
});