CREATE OR REPLACE FUNCTION public.sync_transaction_provision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
IF NEW.tipo='saida' AND NEW.responsavel='Felipe' AND NEW.nao_contabilizar THEN
 DELETE FROM public.provisions WHERE transaction_id=NEW.id AND status='provisionado';
 RETURN NEW;
END IF;
IF (NEW.tipo<>'saida' OR NOT public.is_personal_transaction(NEW.responsavel,NEW.nao_contabilizar)) AND EXISTS(SELECT 1 FROM public.provisions WHERE transaction_id=NEW.id) THEN RAISE EXCEPTION 'Remova o provisionamento antes de mudar o tipo ou responsável.'; END IF;
UPDATE public.provisions SET status=CASE WHEN NEW.pago THEN 'pago' ELSE 'provisionado' END,pago_em=CASE WHEN NEW.pago THEN NEW.data_pagamento ELSE NULL END,valor_pago=CASE WHEN NEW.pago THEN NEW.valor ELSE NULL END WHERE transaction_id=NEW.id;
RETURN NEW; END $$;
CREATE FUNCTION public.set_transaction_accounting(p_ids uuid[],p_excluded boolean,p_person text DEFAULT 'Empresa',p_note text DEFAULT NULL,p_forward boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE ids uuid[]; n integer; roots integer; eligible integer;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
IF cardinality(p_ids) IS NULL OR cardinality(p_ids)=0 THEN RAISE EXCEPTION 'Selecione lançamentos.'; END IF;
IF p_excluded AND (length(trim(coalesce(p_person,'')))=0 OR length(p_person)>200) THEN RAISE EXCEPTION 'Informe quem vai reembolsar (até 200 caracteres).'; END IF;
IF length(p_note)>200 THEN RAISE EXCEPTION 'Observação deve ter até 200 caracteres.'; END IF;
SELECT count(DISTINCT x) INTO roots FROM unnest(p_ids) x;
SELECT count(*) INTO eligible FROM public.transactions WHERE id=ANY(p_ids) AND user_id=auth.uid() AND tipo='saida' AND responsavel='Felipe' AND nao_contabilizar<>p_excluded;
SELECT array_agg(DISTINCT t.id) INTO ids FROM public.transactions t WHERE t.user_id=auth.uid() AND t.tipo='saida' AND t.responsavel='Felipe' AND t.nao_contabilizar<>p_excluded AND EXISTS(SELECT 1 FROM public.transactions r WHERE r.id=ANY(p_ids) AND r.user_id=auth.uid() AND r.tipo='saida' AND r.responsavel='Felipe' AND r.nao_contabilizar<>p_excluded AND (t.id=r.id OR (p_forward AND r.recorrencia<>'unica' AND r.grupo_id IS NOT NULL AND t.grupo_id=r.grupo_id AND t.data_vencimento>=r.data_vencimento)));
PERFORM id FROM public.transactions WHERE id=ANY(ids) AND user_id=auth.uid() ORDER BY id FOR UPDATE;
UPDATE public.transactions SET nao_contabilizar=p_excluded,reembolso_de=CASE WHEN p_excluded THEN trim(p_person) ELSE NULL END,recebido=false,recebido_em=NULL,observacoes=CASE WHEN p_excluded AND nullif(trim(p_note),'') IS NOT NULL THEN concat_ws(E'\n',nullif(observacoes,''),trim(p_note)) ELSE observacoes END WHERE id=ANY(ids) AND user_id=auth.uid() AND tipo='saida' AND responsavel='Felipe' AND nao_contabilizar<>p_excluded;
GET DIAGNOSTICS n=ROW_COUNT;
RETURN jsonb_build_object('alterados',n,'ignorados',roots-eligible); END $$;
REVOKE ALL ON FUNCTION public.set_transaction_accounting(uuid[],boolean,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_transaction_accounting(uuid[],boolean,text,text,boolean) TO authenticated,service_role;
CREATE FUNCTION public.receive_jessica_transactions(p_ids uuid[],p_received boolean,p_date date DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
IF p_received AND (p_date IS NULL OR p_date>(now() AT TIME ZONE 'America/Sao_Paulo')::date) THEN RAISE EXCEPTION 'Informe uma data de recebimento válida, sem datas futuras.'; END IF;
UPDATE public.transactions SET recebido=p_received,recebido_em=CASE WHEN p_received THEN p_date ELSE NULL END WHERE id=ANY(p_ids) AND user_id=auth.uid() AND responsavel='Jéssica';
GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.receive_jessica_transactions(uuid[],boolean,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_jessica_transactions(uuid[],boolean,date) TO authenticated,service_role;