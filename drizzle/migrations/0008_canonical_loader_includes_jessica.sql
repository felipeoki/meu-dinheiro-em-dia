DO $ddl$
DECLARE body text;
BEGIN
SELECT prosrc INTO body FROM pg_proc WHERE oid='public.carregar_dados_planilha(uuid)'::regprocedure;
body:=regexp_replace(body,'END\s*$','PERFORM public.carregar_dados_jessica(uid); END');
EXECUTE format('CREATE OR REPLACE FUNCTION public.carregar_dados_planilha(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS %L',body);
END $ddl$;
CREATE OR REPLACE FUNCTION public.seed_user(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.carregar_dados_planilha(uid); END $$;
REVOKE EXECUTE ON FUNCTION public.seed_user(uuid),public.carregar_dados_planilha(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seed_user(uuid),public.carregar_dados_planilha(uuid) TO service_role;