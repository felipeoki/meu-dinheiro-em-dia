import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAccounts, useAllTransactions, useCategories } from '@/lib/data';
import { buildJessicaReport, buildReimbursementReport } from '@/lib/receipt-reports';

export function ReceiptPdfButton({ month, kind='reembolsos' }: {month:string;kind?:'reembolsos'|'jessica'}) {
  const {data:txs}=useAllTransactions(),{data:accounts}=useAccounts(),{data:categories}=useCategories();
  const [busy,setBusy]=useState(false);
  const generate=async()=>{
    if(!txs||!accounts||!categories)return;
    setBusy(true);
    try{
      const r=(kind==='jessica'?buildJessicaReport:buildReimbursementReport)({txs,month,accounts,categories});
      const [{renderReceiptReportPdf,receiptReportFileName},{downloadPdf}]=await Promise.all([import('@/lib/receipt-reports-pdf'),import('@/lib/pdf-common')]);
      downloadPdf(renderReceiptReportPdf(r).output('blob'),receiptReportFileName(r));toast.success('PDF gerado');
    }catch{toast.error('Não foi possível gerar o PDF.');}finally{setBusy(false);}
  };
  return <Button size="sm" variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal text-left" disabled={busy||!txs||!accounts||!categories} onClick={generate}>
    {busy?<Loader2 className="shrink-0 animate-spin"/>:<FileDown className="shrink-0"/>}{busy?'Gerando…':kind==='jessica'?'Gerar PDF para a Jéssica':'PDF dos não contabilizados'}
  </Button>;
}