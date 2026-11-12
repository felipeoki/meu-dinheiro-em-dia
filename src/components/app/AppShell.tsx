import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, LayoutDashboard, ListChecks, LogOut, MoreHorizontal, ShoppingCart, Wallet, NotebookPen, TrendingUp, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TxFormHost } from "./TxForm";
import { useQuery } from "@tanstack/react-query";
import { cdiQuery } from "@/lib/investments.queries";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lancamentos", label: "Lançamentos", icon: ListChecks },
  { to: "/mercado", label: "Mercado", icon: ShoppingCart },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/mais", label: "Mais", icon: MoreHorizontal },
] as const;
const DESKTOP_NAV = [...NAV.slice(0, 4), { to: "/provisionamento", label: "Provisionamento", icon: Landmark }, { to: "/projecao", label: "Projeção", icon: TrendingUp }, { to: "/anotacoes", label: "Anotações", icon: NotebookPen }, { to: "/investimentos", label: "Investimentos", icon: TrendingUp }, NAV[4]] as const;

export function AppShell() {
  useQuery(cdiQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Finanças</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {DESKTOP_NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              activeProps={{ className: "bg-sidebar-accent !text-foreground" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <button onClick={signOut} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
              activeProps={{ className: "!text-primary" }}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
      <TxFormHost />
    </div>
  );
}
