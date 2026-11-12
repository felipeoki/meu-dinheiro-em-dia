CREATE TABLE public.provisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
 valor_provisionado numeric NOT NULL,
 status text NOT NULL DEFAULT 'provisionado',
 enviado_em timestamptz NOT NULL DEFAULT now(),
 pago_em date,
 valor_pago numeric,
 observacao text,
 CONSTRAINT provisions_transaction_unique UNIQUE(transaction_id),
 CONSTRAINT provisions_positive CHECK (valor_provisionado > 0),
 CONSTRAINT provisions_status CHECK (status IN ('provisionado','pago')),
 CONSTRAINT provisions_observation CHECK (length(observacao) <= 200)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provisions TO authenticated;
GRANT ALL ON public.provisions TO service_role;
ALTER TABLE public.provisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY provisions_own ON public.provisions FOR ALL TO authenticated
 USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));
CREATE INDEX provisions_owner_status ON public.provisions(user_id,status);
CREATE FUNCTION public.validate_provision() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t public.transactions;
BEGIN
 SELECT * INTO t FROM public.transactions WHERE id = NEW.transaction_id FOR UPDATE;
 IF NOT FOUND OR t.user_id <> NEW.user_id THEN RAISE EXCEPTION 'Lançamento não encontrado.'; END IF;
 IF TG_OP = 'UPDATE' AND (NEW.transaction_id <> OLD.transaction_id OR NEW.user_id <> OLD.user_id) THEN RAISE EXCEPTION 'O lançamento da provisão não pode ser alterado.'; END IF;
 IF TG_OP = 'INSERT' AND (t.tipo <> 'saida' OR t.pago OR t.nao_contabilizar) THEN RAISE EXCEPTION 'Somente saídas pessoais pendentes podem ser provisionadas.'; END IF;
 NEW.status := CASE WHEN t.pago THEN 'pago' ELSE 'provisionado' END;
 NEW.pago_em := CASE WHEN t.pago THEN t.data_pagamento ELSE NULL END;
 NEW.valor_pago := CASE WHEN t.pago THEN t.valor ELSE NULL END;
 RETURN NEW;
END $$;
CREATE TRIGGER provisions_validate BEFORE INSERT OR UPDATE ON public.provisions FOR EACH ROW EXECUTE FUNCTION public.validate_provision();
CREATE FUNCTION public.sync_transaction_provision() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT NEW.pago AND (NEW.tipo <> 'saida' OR NEW.nao_contabilizar) AND EXISTS (SELECT 1 FROM public.provisions WHERE transaction_id = NEW.id) THEN
  RAISE EXCEPTION 'Remova o provisionamento antes de mudar o tipo ou marcar não contabilizar.';
 END IF;
 UPDATE public.provisions SET status = CASE WHEN NEW.pago THEN 'pago' ELSE 'provisionado' END,
 pago_em = CASE WHEN NEW.pago THEN NEW.data_pagamento ELSE NULL END,
 valor_pago = CASE WHEN NEW.pago THEN NEW.valor ELSE NULL END WHERE transaction_id = NEW.id;
 RETURN NEW;
END $$;
CREATE TRIGGER transactions_sync_provision AFTER UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_provision();
CREATE FUNCTION public.provision_transactions(p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item jsonb; t public.transactions; n integer := 0; ignored integer := 0; v numeric;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
 IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Selecione lançamentos.'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'transaction_id' LOOP
  SELECT * INTO t FROM public.transactions WHERE id = (item->>'transaction_id')::uuid AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR t.tipo <> 'saida' OR t.pago OR t.nao_contabilizar OR EXISTS (SELECT 1 FROM public.provisions WHERE transaction_id = t.id) THEN ignored := ignored + 1; CONTINUE; END IF;
  v := COALESCE((item->>'valor')::numeric,t.valor);
  IF v <= 0 OR v::text IN ('NaN','Infinity','-Infinity') OR length(item->>'observacao') > 200 THEN RAISE EXCEPTION 'Informe um valor positivo e observação de até 200 caracteres.'; END IF;
  INSERT INTO public.provisions(user_id,transaction_id,valor_provisionado,observacao) VALUES(auth.uid(),t.id,v,NULLIF(item->>'observacao',''));
  n := n + 1;
 END LOOP;
 RETURN jsonb_build_object('enviados',n,'ignorados',ignored);
END $$;
CREATE FUNCTION public.pay_provisions(p_items jsonb, p_date date) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item jsonb; p public.provisions; v numeric;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
 IF p_date IS NULL OR p_date > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'A data de pagamento não pode ser futura.'; END IF;
 IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Selecione provisões.'; END IF;
 PERFORM t.id FROM public.transactions t JOIN public.provisions p ON p.transaction_id = t.id WHERE p.user_id = auth.uid() AND p.id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(p_items)) ORDER BY t.id FOR UPDATE OF t;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO p FROM public.provisions WHERE id = (item->>'id')::uuid AND user_id = auth.uid() AND status = 'provisionado' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provisão não está mais ativa. Atualize a lista.'; END IF;
  v := (item->>'valor')::numeric;
  IF v IS NULL OR v <= 0 OR v::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Informe valores pagos positivos.'; END IF;
  UPDATE public.transactions SET valor = v, pago = true, data_pagamento = p_date WHERE id = p.transaction_id AND user_id = auth.uid();
 END LOOP;
END $$;
CREATE FUNCTION public.undo_provision_payment(p_id uuid) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE tx_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
 SELECT transaction_id INTO tx_id FROM public.provisions WHERE id = p_id AND user_id = auth.uid() AND status = 'pago';
 IF tx_id IS NULL THEN RAISE EXCEPTION 'Pagamento não encontrado.'; END IF;
 UPDATE public.transactions SET pago = false, data_pagamento = NULL WHERE id = tx_id AND user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.provision_transactions(jsonb), public.pay_provisions(jsonb,date), public.undo_provision_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provision_transactions(jsonb), public.pay_provisions(jsonb,date), public.undo_provision_payment(uuid) TO authenticated;
