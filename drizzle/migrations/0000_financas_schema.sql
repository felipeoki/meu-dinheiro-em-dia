
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#64748b',
  icone text NOT NULL DEFAULT 'tag',
  orcamento_mensal numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categories" ON public.categories FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  orcamento_mercado numeric(12,2) NOT NULL DEFAULT 1200,
  lazer_por_ciclo numeric(12,2) NOT NULL DEFAULT 500,
  dia_corte_ciclo int NOT NULL DEFAULT 24,
  dia_fechamento_cartao int NOT NULL DEFAULT 26
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  descricao text NOT NULL DEFAULT '',
  categoria_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  valor numeric(12,3) NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  pago boolean NOT NULL DEFAULT false,
  data_pagamento date,
  forma_pagamento text NOT NULL DEFAULT 'Conta',
  recorrencia text NOT NULL DEFAULT 'unica' CHECK (recorrencia IN ('unica','fixa','parcelada')),
  parcela_atual int,
  parcelas_total int,
  grupo_id uuid,
  ciclo int,
  bonificacao boolean NOT NULL DEFAULT false,
  encerrada boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.transactions (user_id, data_vencimento);
CREATE INDEX ON public.transactions (grupo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- default ciclo from cut day
CREATE OR REPLACE FUNCTION public.tx_set_ciclo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE corte int;
BEGIN
  IF NEW.ciclo IS NULL OR (NEW.tipo = 'saida' AND (TG_OP = 'INSERT' OR NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento)) THEN
    SELECT dia_corte_ciclo INTO corte FROM public.settings WHERE user_id = NEW.user_id;
    corte := coalesce(corte, 24);
    NEW.ciclo := CASE WHEN extract(day FROM NEW.data_vencimento) < corte THEN 1 ELSE 2 END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tx_ciclo BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.tx_set_ciclo();

CREATE OR REPLACE FUNCTION public.month_day(m date, d int) RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT make_date(extract(year FROM m)::int, extract(month FROM m)::int,
    least(d, extract(day FROM (date_trunc('month', m) + interval '1 month - 1 day'))::int))
$$;

-- extend fixed recurrences through a given month (+11 months ahead)
CREATE OR REPLACE FUNCTION public.ensure_fixed(p_until date) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r record; target date; m date;
BEGIN
  target := date_trunc('month', p_until)::date + interval '11 months';
  FOR r IN
    SELECT DISTINCT ON (grupo_id) * FROM public.transactions
    WHERE user_id = auth.uid() AND recorrencia = 'fixa' AND grupo_id IS NOT NULL
      AND grupo_id NOT IN (SELECT grupo_id FROM public.transactions WHERE user_id = auth.uid() AND encerrada AND grupo_id IS NOT NULL)
    ORDER BY grupo_id, data_vencimento DESC
  LOOP
    m := (date_trunc('month', r.data_vencimento) + interval '1 month')::date;
    WHILE m <= target LOOP
      INSERT INTO public.transactions (user_id, tipo, descricao, categoria_id, valor, data_vencimento, forma_pagamento, recorrencia, grupo_id, ciclo, bonificacao, observacoes)
      VALUES (r.user_id, r.tipo, r.descricao, r.categoria_id, r.valor, public.month_day(m, extract(day FROM r.data_vencimento)::int), r.forma_pagamento, 'fixa', r.grupo_id, CASE WHEN r.tipo='entrada' THEN r.ciclo END, r.bonificacao, r.observacoes);
      m := (m + interval '1 month')::date;
    END LOOP;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_fixed(date) TO authenticated;

-- seeding helper
CREATE OR REPLACE FUNCTION public._seed_series(uid uuid, p_tipo text, p_desc text, p_cat uuid, p_valor numeric, p_day int, p_n int, p_rec text, p_forma text, p_ciclo int DEFAULT NULL, p_bonus boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g uuid := gen_random_uuid(); i int; m date;
BEGIN
  FOR i IN 1..p_n LOOP
    m := (date '2026-10-01' + make_interval(months => i-1))::date;
    INSERT INTO public.transactions (user_id, tipo, descricao, categoria_id, valor, data_vencimento, forma_pagamento, recorrencia, parcela_atual, parcelas_total, grupo_id, ciclo, bonificacao)
    VALUES (uid, p_tipo, p_desc, p_cat, p_valor, public.month_day(m, p_day), p_forma, p_rec,
      CASE WHEN p_rec='parcelada' THEN i END, CASE WHEN p_rec='parcelada' THEN p_n END, g, p_ciclo, p_bonus);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.seed_user(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c jsonb := '{}'; r record; v numeric; F int := 13;
BEGIN
  INSERT INTO public.settings (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  FOR r IN SELECT * FROM (VALUES
    ('Moradia','#0ea5e9','home'),('Família/Sofia','#ec4899','heart'),('Educação','#8b5cf6','graduation-cap'),
    ('Saúde','#10b981','stethoscope'),('Transporte','#f59e0b','car'),('Impostos/MEI','#64748b','landmark'),
    ('Assinaturas','#6366f1','repeat'),('Mercado','#22c55e','shopping-cart'),('Lazer','#f97316','party-popper'),
    ('Pets','#a16207','dog'),('Financiamentos/Parcelados','#dc2626','credit-card'),('Cartão de crédito','#7c3aed','wallet'),
    ('Reserva/Poupança','#0d9488','piggy-bank'),('Outros','#94a3b8','tag'),('Salário','#16a34a','banknote')
  ) AS t(n, cor, ic) LOOP
    INSERT INTO public.categories (user_id, nome, cor, icone, orcamento_mensal)
    VALUES (uid, r.n, r.cor, r.ic, CASE WHEN r.n='Mercado' THEN 1200 END)
    RETURNING jsonb_build_object(r.n, id) || c INTO c;
  END LOOP;

  PERFORM _seed_series(uid,'entrada','Salário Ciclo 1',(c->>'Salário')::uuid,8067,8,F,'fixa','Conta',1);
  PERFORM _seed_series(uid,'entrada','Salário Ciclo 2',(c->>'Salário')::uuid,8067,22,F,'fixa','Conta',2);
  PERFORM _seed_series(uid,'entrada','Bonificação Ciclo 1',(c->>'Salário')::uuid,1000,8,F,'fixa','Conta',1,true);
  PERFORM _seed_series(uid,'entrada','Bonificação Ciclo 2',(c->>'Salário')::uuid,1000,22,F,'fixa','Conta',2,true);

  FOR r IN SELECT * FROM (VALUES
    ('Planejados Apto Mãe',8,1041.67,10,'Família/Sofia','Conta'),
    ('Futebol AABB',8,50,0,'Lazer','Conta'),
    ('Futebol Baumer',8,35,0,'Lazer','Conta'),
    ('Mãe Lúcia',8,150,0,'Família/Sofia','Conta'),
    ('Corte Cabelo',8,35,0,'Outros','Conta'),
    ('Recanto',8,249,0,'Lazer','Conta'),
    ('Aluguel AP',8,1496.37,0,'Moradia','Conta'),
    ('Geladeira Mãe',10,54.56,20,'Financiamentos/Parcelados','Conta'),
    ('Máquina de Lavar Mãe',10,58.36,21,'Financiamentos/Parcelados','Conta'),
    ('Sofá Mãe',10,113.91,12,'Financiamentos/Parcelados','Conta'),
    ('Claro Fibra 500MB',10,170.90,0,'Moradia','Conta'),
    ('Escola Sofia (Imaculada)',10,907.255,4,'Educação','Conta'),
    ('Ballet Sofia (Imaculada)',10,75,4,'Educação','Conta'),
    ('Condomínio AP',10,162.02,0,'Moradia','Conta'),
    ('Luz',13,350.23,0,'Moradia','Conta'),
    ('AP Mãe/Pai/Rafa',15,866.72,0,'Moradia','Conta'),
    ('Unimed Felipe',15,529.90,0,'Saúde','Conta'),
    ('DAS - MEI (Felipe)',20,86.05,0,'Impostos/MEI','Conta'),
    ('DAS - MEI (Jéssica)',20,86.05,0,'Impostos/MEI','Conta'),
    ('Plano Vivo Controle - Felipe',20,82,0,'Assinaturas','Conta'),
    ('FIES - Felipe',24,478.31,91,'Educação','Conta'),
    ('Apple Backup',24,19.90,0,'Assinaturas','Conta'),
    ('Água',24,120.22,0,'Moradia','Conta'),
    ('Reserva Sofia',24,250,0,'Reserva/Poupança','Conta'),
    ('Aniver Sofia',24,250,0,'Família/Sofia','Conta'),
    ('Ração/Remédio Cachorros',24,320,0,'Pets','Conta'),
    ('IPVA 2026 Polo / Fit',25,343.08,3,'Transporte','Conta'),
    ('Polo 2020 - 200TSI Highline',25,956.13,16,'Transporte','Conta'),
    ('Pedra (MogiGran)',25,175,7,'Financiamentos/Parcelados','Conta'),
    ('Perfume Felipe (Sair)',25,56,3,'Financiamentos/Parcelados','Conta'),
    ('Lençol',25,75,4,'Financiamentos/Parcelados','Conta'),
    ('Desumidificador',26,350,3,'Cartão de crédito','Nubank Pessoal'),
    ('Aparador',26,33.08,2,'Cartão de crédito','Nubank Pessoal'),
    ('Casa Zaniboni',26,53.24,3,'Cartão de crédito','Nubank Pessoal'),
    ('Buckman Modas Outlet',26,197.99,2,'Cartão de crédito','Nubank Pessoal'),
    ('Bolsa Jessica',26,176.65,3,'Cartão de crédito','Nubank Pessoal'),
    ('Bagaggio - Mochila Felipe',26,89.97,3,'Cartão de crédito','Nubank Pessoal'),
    ('Tenis Sofia',26,49.625,3,'Cartão de crédito','Nubank Pessoal'),
    ('Japonesa Kids',26,61.125,2,'Cartão de crédito','Nubank Pessoal'),
    ('Seguro Polo',26,312.58,11,'Transporte','Nubank Pessoal'),
    ('Bateria Polo',26,53,3,'Transporte','Nubank Pessoal'),
    ('Lovable',26,27.50,0,'Assinaturas','Nubank Pessoal'),
    ('Supercoffe',26,96.43,0,'Assinaturas','Nubank Pessoal'),
    ('Netflix',26,25,0,'Assinaturas','Nubank Pessoal'),
    ('Prudential',26,253.92,0,'Assinaturas','Nubank Pessoal')
  ) AS t(d, dia, val, n, cat, forma) LOOP
    PERFORM _seed_series(uid,'saida',r.d,(c->>r.cat)::uuid,r.val,r.dia,
      CASE WHEN r.n=0 THEN F ELSE r.n END, CASE WHEN r.n=0 THEN 'fixa' ELSE 'parcelada' END, r.forma);
  END LOOP;

  FOREACH v IN ARRAY ARRAY[85.86,167.66,386.89,138.71,126.80,53.00,125.68,72.86,15.00,40.86,15.00,15.00,62.15,79.77,20.93,42.29,100.35,15.00,25.00,61.99,30.00] LOOP
    INSERT INTO public.transactions (user_id, tipo, descricao, categoria_id, valor, data_vencimento, pago, data_pagamento, forma_pagamento, recorrencia, observacoes)
    VALUES (uid,'saida', CASE WHEN v=126.80 THEN '1/2 produtos limpeza' WHEN v=53.00 THEN 'mac balão' ELSE 'Compra mercado' END,
      (c->>'Mercado')::uuid, v, '2026-09-26', true, '2026-09-26', 'Dinheiro/Pix', 'unica', 'Data provisória');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_user(NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_seed AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.seed_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._seed_series(uuid,text,text,uuid,numeric,int,int,text,text,int,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
