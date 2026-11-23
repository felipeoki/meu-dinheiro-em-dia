import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAccounts, useCategories, useAllTransactions, useSettings } from "@/lib/data";
import { provisionsQuery } from "@/lib/provisions.queries";
import { buildMonthReport } from "@/lib/month-report";
import { saoPauloToday } from "@/lib/contributions";

export function MonthPdfButton({ month }: { month: string }) {
  const { data: txs } = useAllTransactions();
  const { data: cats } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: settings } = useSettings();
  const { data: provisions } = useQuery(provisionsQuery);
  const [busy, setBusy] = useState(false);
  const ready = !!txs && !!cats && !!accounts && !!settings && !!provisions;
  const generate = async () => {
    if (!txs || !cats || !accounts || !settings || !provisions) return;
    setBusy(true);
    try {
      const report = buildMonthReport({ txs, month, settings, categories: cats, accounts, today: saoPauloToday(),
        activeProvisionTxIds: new Set(provisions.filter(p => p.status === "provisionado").map(p => p.transaction_id)) });
      const { renderMonthReportPdf, reportFileName } = await import("@/lib/month-report-pdf");
      const blob = renderMonthReportPdf(report).output("blob");
      const { downloadPdf } = await import('@/lib/pdf-common');
      downloadPdf(blob, reportFileName(month));
      toast.success("PDF gerado");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={generate} disabled={!ready || busy}>
      {busy ? <Loader2 className="animate-spin" /> : <FileDown />}{busy ? "Gerando…" : "Gerar PDF"}
    </Button>
  );
}
