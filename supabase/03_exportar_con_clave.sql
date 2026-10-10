-- =====================================================================
--  VEGA · Exportar productos a Excel, protegido con la MISMA clave
--  que la importación (la de 02_importar_con_clave.sql).
--
--  Cómo usarlo:
--    Ejecuta primero 02_importar_con_clave.sql (ahí se crea la clave).
--    Luego pega TODO este archivo en Supabase > SQL Editor > Run.
--    Aquí NO se escribe ninguna clave.
-- =====================================================================

-- exportar_productos(clave) -> [{"estilo","descripcion","marca"}, ...]
create or replace function public.exportar_productos(p_clave text)
returns jsonb
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

  return coalesce(
    (select jsonb_agg(jsonb_build_object('estilo', estilo, 'descripcion', descripcion, 'marca', marca) order by estilo)
       from public.productos),
    '[]'::jsonb
  );
end $$;

revoke all on function public.exportar_productos(text) from public;
grant execute on function public.exportar_productos(text) to anon, authenticated;

notify pgrst, 'reload schema';
