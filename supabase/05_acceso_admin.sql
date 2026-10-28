-- =====================================================================
--  VEGA · Acceso de administrador al módulo "Rótulo automático"
--
--  Usa la MISMA clave de la importación (02_importar_con_clave.sql).
--  La clave nunca viaja a la app: Supabase solo responde si es correcta.
--
--  Cómo usarlo:
--    Ejecuta primero 02_importar_con_clave.sql (ahí se crea la clave).
--    Luego pega TODO este archivo en Supabase > SQL Editor > Run.
--    Aquí NO se escribe ninguna clave.
-- =====================================================================

-- verificar_clave(clave) -> true si es correcta (si no, error "Clave incorrecta.")
create or replace function public.verificar_clave(p_clave text)
returns boolean
language plpgsql
security definer
set search_path = public, privado, extensions
as $$
declare
  v_hash text;
begin
  select clave_hash into v_hash from privado.config where id = 1;
  if v_hash is null or p_clave is null or extensions.crypt(p_clave, v_hash) <> v_hash then
    perform pg_sleep(1); -- frena intentos de adivinar la clave
    raise exception 'Clave incorrecta.' using errcode = '28P01';
  end if;
  return true;
end $$;

revoke all on function public.verificar_clave(text) from public;
grant execute on function public.verificar_clave(text) to anon, authenticated;

notify pgrst, 'reload schema';
