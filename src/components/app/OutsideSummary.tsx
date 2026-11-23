import { Link } from '@tanstack/react-router';
import { useAllTransactions } from '@/lib/data';
import { outsideSummary } from '@/lib/outside-accounting';
import { fmtBRL } from '@/lib/finance';
import { ReceiptPdfButton } from './ReceiptPdfButton';
export function OutsideSummary({ month, compact = false }: { month: string; compact?: boolean }) {
  const { data: rows, isError } = useAllTransactions();
  if (!rows) return <p className="my-4 text-sm text-muted-foreground">{isError ? 'Não foi possível carregar os valores fora das contas.' : 'Carregando valores fora das contas…'}</p>;
  const s = outsideSummary(rows, month);
  return <section aria-label="Fora das minhas contas" className="my-4 border-y py-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">Fora das minhas contas</h2><strong className={compact ? 'tabular text-lg' : 'tabular text-2xl'}>{fmtBRL(s.total)}</strong></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div><Link className="text-sm font-semibold underline" to="/lancamentos" search={{ contabilizacao: 'fora' }}>Reembolsos</Link><p className="mt-1 flex flex-wrap gap-x-3 text-xs"><span className="text-warning-foreground">A receber: {fmtBRL(s.reembolsos.pendente)}</span><span className="text-income">Recebido: {fmtBRL(s.reembolsos.recebido)}</span></p></div>
      <div><Link className="text-sm font-semibold underline" to="/jessica">Jéssica</Link><p className="mt-1 flex flex-wrap gap-x-3 text-xs"><span className="text-warning-foreground">A receber: {fmtBRL(s.jessica.pendente)}</span><span className="text-income">Recebido: {fmtBRL(s.jessica.recebido)}</span></p></div>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Pendente acumulado de todos os meses: <strong className="tabular text-warning-foreground">{fmtBRL(s.acumulado)}</strong></p>
    <div className="mt-3"><ReceiptPdfButton month={month} /></div>
  </section>;
}
