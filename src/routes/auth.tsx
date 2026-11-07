import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Finanças Pessoais" },
      { name: "description", content: "Acesse seu controle de finanças pessoais por ciclos." },
      { property: "og:title", content: "Entrar — Finanças Pessoais" },
      { property: "og:description", content: "Acesse seu controle de finanças pessoais por ciclos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg.includes("Invalid login") ? "E-mail ou senha incorretos." : msg);
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    if (!email) { toast.error("Informe seu e-mail primeiro."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link para redefinir a senha.");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-hero px-6 pb-16 pt-14 text-primary-foreground">
        <div className="mx-auto max-w-sm">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight">Seu dinheiro, ciclo a ciclo.</h1>
          <p className="mt-3 text-primary-foreground/75">Contas, mercado e cartões no lugar da planilha.</p>
        </div>
      </div>
      <div className="-mt-8 px-4">
        <form onSubmit={submit} className="card-soft mx-auto max-w-sm space-y-4 p-6">
          <h2 className="font-display text-xl font-bold">{mode === "in" ? "Entrar" : "Criar conta"}</h2>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Criar uma conta" : "Já tenho conta"}
            </button>
            {mode === "in" && (
              <button type="button" className="text-muted-foreground hover:underline" onClick={forgot}>
                Esqueci a senha
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
