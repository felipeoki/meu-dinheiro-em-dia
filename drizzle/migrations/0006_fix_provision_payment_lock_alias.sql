CREATE OR REPLACE FUNCTION public.pay_provisions(p_items jsonb, p_date date) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item jsonb; provision_row public.provisions; v numeric;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
 IF p_date IS NULL OR p_date > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'A data de pagamento não pode ser futura.'; END IF;
 IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Selecione provisões.'; END IF;
 PERFORM t.id FROM public.transactions t JOIN public.provisions linked ON linked.transaction_id = t.id WHERE linked.user_id = auth.uid() AND linked.id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(p_items)) ORDER BY t.id FOR UPDATE OF t;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO provision_row FROM public.provisions WHERE id = (item->>'id')::uuid AND user_id = auth.uid() AND status = 'provisionado' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provisão não está mais ativa. Atualize a lista.'; END IF;
  v := (item->>'valor')::numeric;
  IF v IS NULL OR v <= 0 OR v::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Informe valores pagos positivos.'; END IF;
  UPDATE public.transactions SET valor = v, pago = true, data_pagamento = p_date WHERE id = provision_row.transaction_id AND user_id = auth.uid();
 END LOOP;
END $$;