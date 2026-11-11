CREATE OR REPLACE FUNCTION public.carregar_dados_planilha(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE r record; aid uuid; cid uuid; g uuid; i int; n int; rec text;
BEGIN
IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'Usuário inexistente'; END IF;
PERFORM pg_advisory_xact_lock(hashtext(uid::text));
IF EXISTS(SELECT 1 FROM public.transactions WHERE user_id=uid) OR EXISTS(SELECT 1 FROM public.notes WHERE user_id=uid) OR EXISTS(SELECT 1 FROM public.investments WHERE user_id=uid) THEN RAISE EXCEPTION 'Limpe os lançamentos, notas e investimentos antes de carregar a planilha'; END IF;
INSERT INTO public.settings(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
FOR r IN SELECT * FROM (VALUES ('Moradia','#0ea5e9','home'),('Família/Sofia','#ec4899','heart'),('Educação','#8b5cf6','graduation-cap'),('Saúde','#10b981','stethoscope'),('Transporte','#f59e0b','car'),('Impostos/MEI','#64748b','landmark'),('Assinaturas','#6366f1','repeat'),('Mercado','#22c55e','shopping-cart'),('Lazer','#f97316','party-popper'),('Pets','#a16207','dog'),('Financiamentos/Parcelados','#dc2626','credit-card'),('Cartão de crédito','#7c3aed','wallet'),('Reserva/Poupança','#0d9488','piggy-bank'),('Outros','#94a3b8','tag'),('Salário','#16a34a','banknote')) t(nome,cor,icone) LOOP
IF NOT EXISTS(SELECT 1 FROM public.categories WHERE user_id=uid AND nome=r.nome) THEN INSERT INTO public.categories(user_id,nome,cor,icone,orcamento_mensal) VALUES(uid,r.nome,r.cor,r.icone,CASE WHEN r.nome='Mercado' THEN 1200 END); END IF;
END LOOP;
FOR r IN SELECT * FROM (VALUES ('Conta','conta_corrente','#0d9488',NULL::int,0),('Nubank Pessoal','cartao_credito','#BC8EDE',26,1),('Nubank Empresa','cartao_credito','#781F6E',26,2),('Cartão da sogra','cartao_credito','#8FC7E8',NULL::int,3),('Dinheiro/Pix','dinheiro','#0d9488',NULL::int,4)) a(nome,tipo,cor,fechamento,ordem) LOOP
SELECT id INTO aid FROM public.accounts WHERE user_id=uid AND nome=r.nome ORDER BY ordem,id LIMIT 1;
IF aid IS NULL THEN INSERT INTO public.accounts(user_id,nome,tipo,cor,dia_fechamento,ordem) VALUES(uid,r.nome,r.tipo,r.cor,r.fechamento,r.ordem); ELSIF r.nome IN('Nubank Pessoal','Nubank Empresa','Cartão da sogra') THEN UPDATE public.accounts SET cor=r.cor WHERE user_id=uid AND nome=r.nome; END IF;
END LOOP;
FOR r IN SELECT * FROM (VALUES
('Conta',8,'Planejados Apto Mãe',1041.67,'9','Financiamentos/Parcelados','saida',false,NULL::int),
('Conta',8,'Futebol AABB',50,'Fixo','Lazer','saida',false,NULL::int),
('Conta',8,'Futebol Baumer',35,'Fixo','Lazer','saida',false,NULL::int),
('Conta',8,'Mãe Lúcia',150,'Fixo','Família/Sofia','saida',false,NULL::int),
('Conta',8,'Corte Cabelo',35,'Fixo','Outros','saida',false,NULL::int),
('Conta',8,'Recanto',249,'Fixo','Lazer','saida',false,NULL::int),
('Conta',8,'Aluguel AP',1496.37,'Fixo','Moradia','saida',false,NULL::int),
('Conta',10,'Geladeira Mãe',54.56,'19','Financiamentos/Parcelados','saida',false,NULL::int),
('Conta',10,'Máquina de Lavar Mãe',58.36,'20','Financiamentos/Parcelados','saida',false,NULL::int),
('Conta',10,'Sofá Mãe',113.91,'11','Financiamentos/Parcelados','saida',false,NULL::int),
('Conta',10,'Claro Fibra 500MB',170.90,'Fixo','Moradia','saida',false,NULL::int),
('Conta',10,'Escola Sofia (Imaculada)',907.255,'3','Educação','saida',false,NULL::int),
('Conta',10,'Ballet Sofia (Imaculada)',75,'3','Educação','saida',false,NULL::int),
('Conta',10,'Condomínio AP',162.02,'Fixo','Moradia','saida',false,NULL::int),
('Conta',13,'Luz',350.23,'Fixo','Moradia','saida',false,NULL::int),
('Conta',15,'AP Mãe/Pai/Rafa',866.72,'Fixo','Família/Sofia','saida',false,NULL::int),
('Conta',15,'Unimed Felipe',529.90,'Fixo','Saúde','saida',false,NULL::int),
('Conta',20,'DAS - MEI (Felipe)',86.05,'Fixo','Impostos/MEI','saida',false,NULL::int),
('Conta',20,'DAS - MEI (Jéssica)',86.05,'Fixo','Impostos/MEI','saida',false,NULL::int),
('Conta',20,'Plano Vivo Controle - Felipe',82,'Fixo','Assinaturas','saida',false,NULL::int),
('Conta',24,'FIES - Felipe',478.31,'90','Financiamentos/Parcelados','saida',false,NULL::int),
('Conta',24,'Água',120.22,'Fixo','Moradia','saida',false,NULL::int),
('Conta',24,'Reserva Sofia',250,'Fixo','Reserva/Poupança','saida',false,NULL::int),
('Conta',24,'Aniver Sofia',250,'Fixo','Família/Sofia','saida',false,NULL::int),
('Conta',24,'Ração/Remédio Cachorros',320,'Fixo','Pets','saida',false,NULL::int),
('Conta',25,'IPVA 2026 Polo / Fit',343.08,'2','Transporte','saida',false,NULL::int),
('Conta',25,'Polo 2020 - 200TSI Highline',956.13,'15','Transporte','saida',false,NULL::int),
('Nubank Pessoal',24,'Apple Backup',19.90,'Fixo','Assinaturas','saida',false,NULL::int),
('Cartão da sogra',25,'Pedra (MogiGran)',175,'6','Moradia','saida',false,NULL::int),
('Cartão da sogra',25,'Perfume Felipe (Sair)',56,'2','Outros','saida',false,NULL::int),
('Cartão da sogra',25,'Lençol',75,'3','Moradia','saida',false,NULL::int),
('Cartão da sogra',25,'Supercoffe',96.43,'Fixo','Assinaturas','saida',false,NULL::int),
('Nubank Empresa',26,'Almoço Sofia Mirim Bar',38.25,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'Neo Hot Dog',98,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'Espetinho Sofia',81.43,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'Mars',8,'1','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Energetico',10.99,'1','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Edevaldorosseto',35,'1','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Amazonas',15,'1','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Gauchao',123.90,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'McDonalds',126.70,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'Taquaral Comida',12,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'Caldo de cana - Taquaral',19,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'Caldo de cana - Taquaral',9,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'João Manara',74.50,'1','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Sem parar',100,'1','Transporte','saida',false,NULL::int),
('Nubank Empresa',26,'Ps Da Cerveja',117.24,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'Loks Beer',63,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'Belasmeias',55.25,'2','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Raia',80.20,'1','Saúde','saida',false,NULL::int),
('Nubank Empresa',26,'Ararazul Sofia',40.90,'1','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Whey',132.50,'1','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Adrianamarcia',14,'1','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Raia',37.33,'1','Saúde','saida',false,NULL::int),
('Nubank Empresa',26,'Servnutre Salgados',37.48,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'Almoço Sofia Mirim Bar',35.25,'1','Lazer','saida',false,NULL::int),
('Nubank Empresa',26,'Desumidificador',350,'2','Moradia','saida',false,NULL::int),
('Nubank Empresa',26,'Aparador',33.08,'1','Moradia','saida',false,NULL::int),
('Nubank Empresa',26,'Casa Zaniboni',53.24,'2','Moradia','saida',false,NULL::int),
('Nubank Empresa',26,'Buckman Modas Outlet',197.99,'1','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Bolsa Jessica',176.65,'2','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Bagaggio - Mochila Felipe',89.97,'2','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Tenis Sofia',49.625,'2','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Japonesa Kids',61.125,'1','Outros','saida',false,NULL::int),
('Nubank Empresa',26,'Seguro Polo',312.58,'10','Transporte','saida',false,NULL::int),
('Nubank Empresa',26,'Lovable',30.82,'Fixo','Assinaturas','saida',false,NULL::int),
('Nubank Empresa',26,'Netflix',25,'Fixo','Assinaturas','saida',false,NULL::int),
('Nubank Empresa',26,'Prudential',253.92,'Fixo','Assinaturas','saida',false,NULL::int),
('Conta',8,'Salário Ciclo 1',8067,'Fixo','Salário','entrada',false,1),
('Conta',22,'Salário Ciclo 2',8067,'Fixo','Salário','entrada',false,2),
('Conta',8,'Bonificação',1000,'Fixo','Salário','entrada',true,1),
('Conta',22,'Bonificação',1000,'Fixo','Salário','entrada',true,2),
('Nubank Empresa',10,'',126.80,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',60,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',26.99,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',442.49,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',15,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',88.59,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',40.77,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',24,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'1/2',158.22,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',66.96,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',114.85,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',119.72,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',31.38,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',35,'1','Mercado','saida',false,NULL::int),
('Nubank Empresa',10,'',65.51,'1','Mercado','saida',false,NULL::int)
) t(conta,dia,descricao,valor,parcelas,categoria,tipo,bonus,ciclo) LOOP
SELECT id INTO aid FROM public.accounts WHERE user_id=uid AND nome=r.conta ORDER BY ordem,id LIMIT 1;
SELECT id INTO cid FROM public.categories WHERE user_id=uid AND nome=r.categoria ORDER BY created_at,id LIMIT 1;
g:=gen_random_uuid(); rec:=CASE WHEN r.parcelas='Fixo' THEN 'fixa' WHEN r.parcelas='1' THEN 'unica' ELSE 'parcelada' END; n:=CASE WHEN rec='parcelada' THEN r.parcelas::int ELSE 1 END;
FOR i IN 1..n LOOP
INSERT INTO public.transactions(user_id,tipo,descricao,categoria_id,valor,data_vencimento,conta_id,recorrencia,parcela_atual,parcelas_total,grupo_id,ciclo,bonificacao,pago,observacoes) VALUES(uid,r.tipo,r.descricao,cid,r.valor,public.month_day((date '2026-11-01'+make_interval(months=>i-1))::date,r.dia),aid,rec,CASE WHEN rec='parcelada' THEN i END,CASE WHEN rec='parcelada' THEN n END,g,r.ciclo,r.bonus,false,CASE WHEN r.categoria='Mercado' THEN 'Data provisória da planilha: 10/11/2026' END);
END LOOP;
END LOOP;
INSERT INTO public.notes(user_id,titulo,texto,mes) VALUES(uid,'Reembolsos no Nubank Empresa (não contabilizar)','BYD – R$ 65,60
2 monster (Hp Riks) – R$ 31,98
IA EXPERIENCE – R$ 48,30
IA EXPERIENCE – R$ 73,60
IA EXPERIENCE – R$ 90,00
IA EXPERIENCE – R$ 159,67
IA EXPERIENCE – R$ 90,00
IA EXPERIENCE – R$ 237,00
IA EXPERIENCE – R$ 193,50
IA EXPERIENCE – R$ 75,00
IA EXPERIENCE – R$ 355,00
BYD – R$ 37,38
Bateria Polo (2 parcelas restantes) – R$ 53,00
Total: R$ 1.510,03',date '2026-11-01');
INSERT INTO public.notes(user_id,titulo,texto,mes) VALUES(uid,'Detalhe das faturas Nubank (referência)','Nubank Empresa:
Posto Guaçu Brasil – R$ 295,24
Bixão Polo – R$ 27,90
Belasmeias 1/2 – R$ 55,25
Farmacia Progresso – R$ 30,80
Celebra Brasil – R$ 23,40
Isaac Tecserv 1/5 – R$ 391,95
Prime Esfirra – R$ 95,25
Espetinho do Ti – R$ 45,00
Posto Guaçu Brasil – R$ 286,84
Top Flex Conveniencia – R$ 50,00
Whey – R$ 132,50
Otica real – R$ 90,00
Desumidificador 2/3 – R$ 149,49
Casa Zaniboni 2/3 – R$ 53,24
Aparador 3/3 – R$ 33,08
Amazon 2/2 – R$ 38,95
Bia Harmonização 3/6 – R$ 150,00
Studio A – R$ 158,00
Villa Rosa 4/5 – R$ 77,94
Sonia Calçados 4/5 – R$ 78,00
NutriNatalia 4/5 – R$ 24,14
Supercoffe (Fixo) – R$ 96,43
Tenis Sofia 5/6 – R$ 49,63
Japonesa Kids 6/6 – R$ 61,13
Julemehair 6/6 – R$ 42,86
Netflix – R$ 19,90
Apple.Com/Bill – R$ 66,90
Total Nubank Empresa: R$ 2.623,82
Nubank Pessoal:
Apple.Com/Bill – R$ 30,90',date '2026-11-01');
END $fn$;
REVOKE EXECUTE ON FUNCTION public.carregar_dados_planilha(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.carregar_dados_planilha(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.seed_user(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$ BEGIN PERFORM public.carregar_dados_planilha(uid); END $fn$;
REVOKE EXECUTE ON FUNCTION public.seed_user(uuid) FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.carregar_dados_planilha(uuid) IS 'Canonical November 2026 spreadsheet loader; privileged-only; requires explicitly cleared transactions, notes and investments. Fixed groups extend via ensure_fixed, installments include all remaining months starting November.';