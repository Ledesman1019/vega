-- =====================================================================
--  VEGA · Eliminar la base de productos (para subir una nueva y limpia)
--
--  eliminar_base_productos(clave, confirmacion):
--    - exige la clave de administrador
--    - exige escribir la palabra ELIMINAR (evita borrar por un clic)
--    - borra TODOS los productos y sus códigos EAN
--  NO toca: historial de rótulos, paletizado, ingresos ni rótulos
--  automáticos (son tablas aparte y no dependen de productos).
--
--  Cómo usarlo:
--    Ejecuta antes 01 a 06. Luego pega TODO este archivo en
--    Supabase > SQL Editor > Run. Aquí NO se escribe ninguna clave.
-- =====================================================================

create or replace function public.eliminar_base_productos(p_clave text, p_confirmacion text)
returns jsonb
language plpgsql
security definer
set search_path = public, privado, extensions
as $$
declare
  v_eans int;
  v_productos int;
begin
  perform privado.exigir_clave(p_clave);
  if p_confirmacion is distinct from 'ELIMINAR' then
    raise exception 'Escribe ELIMINAR para confirmar.';
  end if;

  -- Con WHERE para que Supabase (safeupdate) acepte el borrado completo
  delete from public.productos_ean where ean is not null;
  get diagnostics v_eans = row_count;
  delete from public.productos where estilo is not null;
  get diagnostics v_productos = row_count;

  return jsonb_build_object('productos', v_productos, 'eans', v_eans);
end $$;

revoke all on function public.eliminar_base_productos(text, text) from public;
grant execute on function public.eliminar_base_productos(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
