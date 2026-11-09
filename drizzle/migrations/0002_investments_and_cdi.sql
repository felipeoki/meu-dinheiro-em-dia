CREATE TABLE public.investments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), nome text NOT NULL,
 valor_inicial numeric NOT NULL DEFAULT 0 CHECK (valor_inicial >= 0), aporte_mensal numeric NOT NULL DEFAULT 0 CHECK (aporte_mensal >= 0),
 data_inicio date NOT NULL CHECK (extract(day from data_inicio) = 1),
 tipo_taxa text NOT NULL CHECK (tipo_taxa IN ('fixa','cdi')),
 taxa_anual numeric CHECK (taxa_anual BETWEEN 0 AND 100), percentual_cdi numeric CHECK (percentual_cdi BETWEEN 0 AND 1000),
 horizonte_anos int NOT NULL DEFAULT 10 CHECK (horizonte_anos BETWEEN 1 AND 50),
 capitalizacao text NOT NULL DEFAULT 'nominal' CHECK (capitalizacao IN ('nominal','composta')),
 cor text NOT NULL DEFAULT 'primary', ativo boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT investment_rate_valid CHECK ((tipo_taxa='fixa' AND taxa_anual IS NOT NULL AND percentual_cdi IS NULL) OR (tipo_taxa='cdi' AND percentual_cdi IS NOT NULL AND taxa_anual IS NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY investments_own ON public.investments FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX investments_user_idx ON public.investments(user_id);
CREATE TABLE public.cdi_rates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), taxa_anual numeric NOT NULL CHECK (taxa_anual BETWEEN 0 AND 100),
 referencia date NOT NULL UNIQUE, fonte text NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cdi_rates TO authenticated;
GRANT ALL ON public.cdi_rates TO service_role;
ALTER TABLE public.cdi_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY cdi_authenticated_read ON public.cdi_rates FOR SELECT TO authenticated USING (true);