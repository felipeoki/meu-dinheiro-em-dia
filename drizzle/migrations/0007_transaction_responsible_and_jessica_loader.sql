ALTER TABLE public.transactions ADD COLUMN responsavel text NOT NULL DEFAULT 'Felipe' CHECK (responsavel IN ('Felipe','Jéssica'));
CREATE FUNCTION public.is_personal_transaction(p_responsavel text,p_excluded boolean) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT p_responsavel='Felipe' AND NOT p_excluded $$;
CREATE OR REPLACE FUNCTION public.ensure_fixed(p_until date) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r record; target date; m date;
BEGIN
PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
target:=date_trunc('month',p_until)::date;
FOR r IN SELECT DISTINCT ON(grupo_id) * FROM public.transactions WHERE user_id=auth.uid() AND recorrencia='fixa' AND grupo_id IS NOT NULL AND grupo_id NOT IN(SELECT grupo_id FROM public.transactions WHERE user_id=auth.uid() AND encerrada AND grupo_id IS NOT NULL) ORDER BY grupo_id,data_vencimento DESC,id LOOP
m:=(date_trunc('month',r.data_vencimento)+interval '1 month')::date;
WHILE m<=target LOOP
INSERT INTO public.transactions(user_id,tipo,descricao,categoria_id,valor,data_vencimento,conta_id,recorrencia,grupo_id,ciclo,bonificacao,observacoes,nao_contabilizar,reembolso_de,recebido,recebido_em,responsavel)
VALUES(r.user_id,r.tipo,r.descricao,r.categoria_id,r.valor,public.month_day(m,extract(day FROM r.data_vencimento)::int),r.conta_id,'fixa',r.grupo_id,CASE WHEN r.tipo='entrada' THEN r.ciclo END,r.bonificacao,r.observacoes,r.nao_contabilizar,r.reembolso_de,false,NULL,r.responsavel);
m:=(m+interval '1 month')::date;
END LOOP; END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.validate_provision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE t public.transactions;
BEGIN
SELECT * INTO t FROM public.transactions WHERE id=NEW.transaction_id FOR UPDATE;
IF NOT FOUND OR t.user_id<>NEW.user_id THEN RAISE EXCEPTION 'Lançamento não encontrado.'; END IF;
IF TG_OP='UPDATE' AND (NEW.transaction_id<>OLD.transaction_id OR NEW.user_id<>OLD.user_id) THEN RAISE EXCEPTION 'O lançamento da provisão não pode ser alterado.'; END IF;
IF TG_OP='INSERT' AND (t.tipo<>'saida' OR t.pago OR NOT public.is_personal_transaction(t.responsavel,t.nao_contabilizar)) THEN RAISE EXCEPTION 'Somente saídas pessoais pendentes do Felipe podem ser provisionadas.'; END IF;
NEW.status:=CASE WHEN t.pago THEN 'pago' ELSE 'provisionado' END;
NEW.pago_em:=CASE WHEN t.pago THEN t.data_pagamento ELSE NULL END;
NEW.valor_pago:=CASE WHEN t.pago THEN t.valor ELSE NULL END;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.sync_transaction_provision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
IF (NEW.tipo<>'saida' OR NOT public.is_personal_transaction(NEW.responsavel,NEW.nao_contabilizar)) AND EXISTS(SELECT 1 FROM public.provisions WHERE transaction_id=NEW.id) THEN RAISE EXCEPTION 'Remova o provisionamento antes de mudar o tipo, responsável ou marcar não contabilizar.'; END IF;
UPDATE public.provisions SET status=CASE WHEN NEW.pago THEN 'pago' ELSE 'provisionado' END,pago_em=CASE WHEN NEW.pago THEN NEW.data_pagamento ELSE NULL END,valor_pago=CASE WHEN NEW.pago THEN NEW.valor ELSE NULL END WHERE transaction_id=NEW.id;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.provision_transactions(p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE item jsonb; t public.transactions; n integer:=0; ignored integer:=0; v numeric;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Selecione lançamentos.'; END IF;
FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'transaction_id' LOOP
SELECT * INTO t FROM public.transactions WHERE id=(item->>'transaction_id')::uuid AND user_id=auth.uid() FOR UPDATE;
IF NOT FOUND OR t.tipo<>'saida' OR t.pago OR NOT public.is_personal_transaction(t.responsavel,t.nao_contabilizar) OR EXISTS(SELECT 1 FROM public.provisions WHERE transaction_id=t.id) THEN ignored:=ignored+1; CONTINUE; END IF;
v:=COALESCE((item->>'valor')::numeric,t.valor);
IF v<=0 OR v::text IN ('NaN','Infinity','-Infinity') OR length(item->>'observacao')>200 THEN RAISE EXCEPTION 'Informe um valor positivo e observação de até 200 caracteres.'; END IF;
INSERT INTO public.provisions(user_id,transaction_id,valor_provisionado,observacao) VALUES(auth.uid(),t.id,v,NULLIF(item->>'observacao','')); n:=n+1;
END LOOP; RETURN jsonb_build_object('enviados',n,'ignorados',ignored); END $$;
CREATE FUNCTION public.carregar_dados_jessica(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE r record; aid uuid; cid uuid; g uuid; i integer; rec text;
BEGIN
IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'Usuário inexistente'; END IF;
PERFORM pg_advisory_xact_lock(hashtext(uid::text));
FOR r IN SELECT * FROM (VALUES
(1,'Posto Guaçu Brasil',295.24,1,1,'Transporte'),(2,'Bixão Polo',27.90,1,1,'Outros'),(3,'Belasmeias',55.25,1,2,'Outros'),(4,'Farmacia Progresso',30.80,1,1,'Saúde'),(5,'Celebra Brasil',23.40,1,1,'Outros'),(6,'Isaac Tecserv',391.95,1,5,'Outros'),(7,'Prime Esfirra',95.25,1,1,'Lazer'),(8,'Espetinho do Ti',45.00,1,1,'Lazer'),(9,'Posto Guaçu Brasil',286.84,1,1,'Transporte'),(10,'Top Flex Conveniencia',50.00,1,1,'Outros'),(11,'Whey',132.50,1,1,'Saúde'),(12,'Otica real',90.00,1,1,'Outros'),(13,'Desumidificador',149.49,2,3,'Moradia'),(14,'Casa Zaniboni',53.24,2,3,'Moradia'),(15,'Aparador',33.08,3,3,'Moradia'),(16,'Amazon',38.95,2,2,'Outros'),(17,'Bia Harmonização',150.00,3,6,'Outros'),(18,'Studio A',158.00,1,1,'Outros'),(19,'Villa Rosa',77.94,4,5,'Outros'),(20,'Sonia Calçados',78.00,4,5,'Outros'),(21,'NutriNatalia',24.14,4,5,'Outros'),(22,'Supercoffe',96.43,0,0,'Assinaturas'),(23,'Tenis Sofia',49.63,5,6,'Outros'),(24,'Japonesa Kids',61.13,6,6,'Outros'),(25,'Julemehair',42.86,6,6,'Outros'),(26,'Netflix',19.90,1,1,'Assinaturas'),(27,'Apple.Com/Bill',66.90,1,1,'Assinaturas'),(28,'Apple.Com/Bill',30.90,1,1,'Assinaturas')
) t(idx,descricao,valor,atual,total,categoria) LOOP
SELECT id INTO aid FROM public.accounts WHERE user_id=uid AND nome=CASE WHEN r.idx=28 THEN 'Nubank Pessoal' ELSE 'Nubank Empresa' END ORDER BY ordem,id LIMIT 1;
IF aid IS NULL THEN INSERT INTO public.accounts(user_id,nome,tipo,cor,dia_fechamento,dia_vencimento) VALUES(uid,CASE WHEN r.idx=28 THEN 'Nubank Pessoal' ELSE 'Nubank Empresa' END,'cartao_credito',CASE WHEN r.idx=28 THEN '#BC8EDE' ELSE '#781F6E' END,26,26) RETURNING id INTO aid; END IF;
SELECT id INTO cid FROM public.categories WHERE user_id=uid AND nome=r.categoria ORDER BY created_at,id LIMIT 1;
IF cid IS NULL THEN INSERT INTO public.categories(user_id,nome) VALUES(uid,r.categoria) RETURNING id INTO cid; END IF;
g:=md5(uid::text||':jessica-november-2026:'||r.idx::text)::uuid;
IF EXISTS(SELECT 1 FROM public.transactions WHERE user_id=uid AND grupo_id=g) THEN CONTINUE; END IF;
rec:=CASE WHEN r.atual=0 THEN 'fixa' WHEN r.total>1 THEN 'parcelada' ELSE 'unica' END;
FOR i IN 0..CASE WHEN rec='parcelada' THEN r.total-r.atual WHEN rec='fixa' THEN 11 ELSE 0 END LOOP
INSERT INTO public.transactions(user_id,tipo,descricao,categoria_id,valor,data_vencimento,conta_id,recorrencia,parcela_atual,parcelas_total,grupo_id,pago,nao_contabilizar,responsavel)
VALUES(uid,'saida',r.descricao,cid,r.valor,public.month_day((date '2026-11-01'+make_interval(months=>i))::date,26),aid,rec,CASE WHEN rec='parcelada' THEN r.atual+i END,CASE WHEN rec='parcelada' THEN r.total END,g,false,false,'Jéssica');
END LOOP; END LOOP; END $fn$;
REVOKE EXECUTE ON FUNCTION public.carregar_dados_jessica(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.carregar_dados_jessica(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.seed_user(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.carregar_dados_planilha(uid); PERFORM public.carregar_dados_jessica(uid); END $$;
REVOKE EXECUTE ON FUNCTION public.seed_user(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seed_user(uuid) TO service_role;