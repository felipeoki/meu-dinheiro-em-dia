ALTER TABLE public.transactions ADD COLUMN nao_contabilizar boolean NOT NULL DEFAULT false, ADD COLUMN reembolso_de text, ADD COLUMN recebido boolean NOT NULL DEFAULT false, ADD COLUMN recebido_em date;
CREATE TABLE public.accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), nome text NOT NULL, tipo text NOT NULL DEFAULT 'conta_corrente' CHECK (tipo IN ('cartao_credito','conta_corrente','dinheiro','outro')), cor text NOT NULL DEFAULT '#0d9488', dia_fechamento int CHECK (dia_fechamento BETWEEN 1 AND 31), dia_vencimento int CHECK (dia_vencimento BETWEEN 1 AND 31), limite numeric CHECK (limite >= 0), ativo boolean NOT NULL DEFAULT true, ordem int NOT NULL DEFAULT 0, UNIQUE(id,user_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE TABLE public.notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), titulo text NOT NULL DEFAULT '', texto text NOT NULL DEFAULT '', mes date, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.notes FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
ALTER TABLE public.transactions ADD COLUMN conta_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_account_owner FOREIGN KEY(conta_id,user_id) REFERENCES public.accounts(id,user_id);
CREATE INDEX ON public.accounts(user_id,ordem);
CREATE INDEX ON public.notes(user_id,created_at);
CREATE INDEX ON public.transactions(conta_id);
INSERT INTO public.accounts(user_id,nome,tipo,dia_fechamento,ordem)
SELECT u.id,v.nome,v.tipo,CASE WHEN v.tipo='cartao_credito' THEN 26 END,v.ordem FROM auth.users u CROSS JOIN (VALUES ('Conta','conta_corrente',0),('Nubank Pessoal','cartao_credito',1),('Nubank Empresa','cartao_credito',2),('Dinheiro/Pix','dinheiro',3)) v(nome,tipo,ordem);
INSERT INTO public.accounts(user_id,nome,tipo,ordem) SELECT DISTINCT t.user_id,t.forma_pagamento,'outro',4 FROM public.transactions t WHERE NOT EXISTS(SELECT 1 FROM public.accounts a WHERE a.user_id=t.user_id AND a.nome=t.forma_pagamento);
UPDATE public.transactions t SET conta_id=a.id FROM public.accounts a WHERE a.user_id=t.user_id AND a.nome=t.forma_pagamento;
COMMENT ON COLUMN public.transactions.forma_pagamento IS 'DEPRECATED: replaced by conta_id; retained only for historical seed compatibility';
CREATE OR REPLACE FUNCTION public._seed_series(uid uuid,p_tipo text,p_desc text,p_cat uuid,p_valor numeric,p_day int,p_n int,p_rec text,p_forma text,p_ciclo int DEFAULT NULL,p_bonus boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g uuid:=gen_random_uuid(); i int; m date; account_id uuid;
BEGIN
SELECT id INTO account_id FROM public.accounts WHERE user_id=uid AND nome=p_forma ORDER BY ordem LIMIT 1;
FOR i IN 1..p_n LOOP
m:=(date '2026-10-01'+make_interval(months=>i-1))::date;
INSERT INTO public.transactions(user_id,tipo,descricao,categoria_id,valor,data_vencimento,conta_id,recorrencia,parcela_atual,parcelas_total,grupo_id,ciclo,bonificacao)
VALUES(uid,p_tipo,p_desc,p_cat,p_valor,public.month_day(m,p_day),account_id,p_rec,CASE WHEN p_rec='parcelada' THEN i END,CASE WHEN p_rec='parcelada' THEN p_n END,g,p_ciclo,p_bonus);
END LOOP;
END $$;
DO $migration$
DECLARE definition text;
BEGIN
SELECT pg_get_functiondef('public.seed_user(uuid)'::regprocedure) INTO definition;
definition:=replace(definition,'BEGIN'||chr(10)||'  INSERT INTO public.settings', 'BEGIN'||chr(10)||'  INSERT INTO public.accounts(user_id,nome,tipo,dia_fechamento,ordem) SELECT uid,v.nome,v.tipo,CASE WHEN v.tipo=''cartao_credito'' THEN 26 END,v.ordem FROM (VALUES (''Conta'',''conta_corrente'',0),(''Nubank Pessoal'',''cartao_credito'',1),(''Nubank Empresa'',''cartao_credito'',2),(''Dinheiro/Pix'',''dinheiro'',3)) v(nome,tipo,ordem);'||chr(10)||'  INSERT INTO public.settings');
definition:=replace(definition,'data_pagamento, forma_pagamento, recorrencia, observacoes)','data_pagamento, conta_id, recorrencia, observacoes)');
definition:=replace(definition,'''Dinheiro/Pix'', ''unica'', ''Data provisória''','(SELECT id FROM public.accounts WHERE user_id=uid AND nome=''Dinheiro/Pix'' LIMIT 1), ''unica'', ''Data provisória''');
EXECUTE definition;
END $migration$;
CREATE OR REPLACE FUNCTION public.ensure_fixed(p_until date) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r record; target date; m date;
BEGIN
PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
target:=date_trunc('month',p_until)::date;
FOR r IN SELECT DISTINCT ON(grupo_id) * FROM public.transactions WHERE user_id=auth.uid() AND recorrencia='fixa' AND grupo_id IS NOT NULL AND grupo_id NOT IN(SELECT grupo_id FROM public.transactions WHERE user_id=auth.uid() AND encerrada AND grupo_id IS NOT NULL) ORDER BY grupo_id,data_vencimento DESC LOOP
m:=(date_trunc('month',r.data_vencimento)+interval '1 month')::date;
WHILE m<=target LOOP
INSERT INTO public.transactions(user_id,tipo,descricao,categoria_id,valor,data_vencimento,conta_id,recorrencia,grupo_id,ciclo,bonificacao,observacoes,nao_contabilizar,reembolso_de,recebido,recebido_em)
VALUES(r.user_id,r.tipo,r.descricao,r.categoria_id,r.valor,public.month_day(m,extract(day FROM r.data_vencimento)::int),r.conta_id,'fixa',r.grupo_id,CASE WHEN r.tipo='entrada' THEN r.ciclo END,r.bonificacao,r.observacoes,r.nao_contabilizar,r.reembolso_de,false,NULL);
m:=(m+interval '1 month')::date;
END LOOP;
END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public._seed_series(uuid,text,text,uuid,numeric,int,int,text,text,int,boolean) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_user(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_fixed(date) TO authenticated;