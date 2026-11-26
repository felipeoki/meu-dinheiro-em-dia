import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GatewayError } from "@lovable.dev/ai-gateway";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { monthEnd, monthStart, type Account, type Category, type Settings, type Tx } from "./finance";
import { actualTotals, compareExpectedTotals, expectedTotalsSchema, type AiAnalysis } from "./reconciliation";

const inputSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expected: expectedTotalsSchema,
}).strict();

interface AnalysisResponse {
  result: ReturnType<typeof compareExpectedTotals>;
  analysis: AiAnalysis | null;
  analysisError: string | null;
}

export const reconcileExpectedTotals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data, context }): Promise<AnalysisResponse> => {
    const [settingsResult, categoriesResult, accountsResult] = await Promise.all([
      context.supabase.from("settings").select("orcamento_mercado,lazer_por_ciclo,dia_corte_ciclo,dia_fechamento_cartao").maybeSingle(),
      context.supabase.from("categories").select("id,nome").order("nome"),
      context.supabase.from("accounts").select("id,nome").order("ordem"),
    ]);
    if (settingsResult.error) throw new Error(settingsResult.error.message);
    if (categoriesResult.error) throw new Error(categoriesResult.error.message);
    if (accountsResult.error) throw new Error(accountsResult.error.message);
    if (!settingsResult.data) throw new Error("As configurações financeiras ainda não foram criadas.");

    const txs: Tx[] = [];
    for (let page = 0; ; page++) {
      const { data: rows, error } = await context.supabase
        .from("transactions")
        .select("*")
        .gte("data_vencimento", monthStart(data.month))
        .lte("data_vencimento", monthEnd(data.month))
        .order("data_vencimento")
        .order("descricao")
        .order("id")
        .range(page * 1000, page * 1000 + 999);
      if (error) throw new Error(error.message);
      txs.push(...rows.map(row => ({ ...row, valor: Number(row.valor), responsavel: row.responsavel === "Jéssica" ? "Jéssica" : "Felipe" }) as Tx));
      if (rows.length < 1000) break;
    }

    const settings: Settings = {
      orcamento_mercado: Number(settingsResult.data.orcamento_mercado),
      lazer_por_ciclo: Number(settingsResult.data.lazer_por_ciclo),
      dia_corte_ciclo: Number(settingsResult.data.dia_corte_ciclo),
      dia_fechamento_cartao: Number(settingsResult.data.dia_fechamento_cartao),
    };
    const categories: Pick<Category, "id" | "nome">[] = categoriesResult.data;
    const accounts: Pick<Account, "id" | "nome">[] = accountsResult.data;
    const actual = actualTotals({ txs, month: data.month, settings, categories, accounts, today: data.today });
    const result = compareExpectedTotals(data.month, actual, data.expected);
    if (result.divergenceCount === 0) return { result, analysis: null, analysisError: null };

    try {
      const { analyzeReconciliation } = await import("./reconciliation-ai.server");
      const analysis = await analyzeReconciliation({ result, txs, settings, categories, accounts });
      return { result, analysis, analysisError: null };
    } catch (error) {
      if (error instanceof GatewayError) {
        console.error("Falha na análise de divergências", { code: error.code, outcome: error.outcome, ids: error.ids });
      } else {
        console.error("Resposta inválida na análise de divergências", error instanceof Error ? error.message : "erro desconhecido");
      }
      return {
        result,
        analysis: null,
        analysisError: "A comparação numérica foi concluída, mas a IA não conseguiu analisar as divergências agora. Tente novamente sem alterar os valores.",
      };
    }
  });
