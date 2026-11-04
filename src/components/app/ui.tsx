import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addMonths, fmtBRL, monthLabel, type Category } from "@/lib/finance";
import { setMonth, useMonth } from "@/lib/data";

export function MonthSelector() {
  const m = useMonth();
  return (
    <div className="flex items-center gap-1 rounded-full border bg-card p-1 shadow-sm">
      <button aria-label="Mês anterior" onClick={() => setMonth(addMonths(m, -1))} className="rounded-full p-1.5 hover:bg-muted">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-32 text-center text-sm font-semibold">{monthLabel(m)}</span>
      <button aria-label="Próximo mês" onClick={() => setMonth(addMonths(m, 1))} className="rounded-full p-1.5 hover:bg-muted">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
      {children}
    </div>
  );
}

export function Money({ v, tipo, className }: { v: number; tipo?: "entrada" | "saida"; className?: string }) {
  return (
    <span className={cn("tabular font-semibold", tipo === "entrada" && "text-income", tipo === "saida" && "text-expense", className)}>
      {fmtBRL(v)}
    </span>
  );
}

export function CatBadge({ cat }: { cat?: Category }) {
  if (!cat) return <span className="text-xs text-muted-foreground">Sem categoria</span>;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: cat.cor + "22", color: cat.cor }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.cor }} />
      {cat.nome}
    </span>
  );
}

export function Empty({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card-soft flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: "income" | "expense"; sub?: ReactNode }) {
  return (
    <div className="card-soft p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 font-display text-xl font-bold", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export const Loading = () => <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
