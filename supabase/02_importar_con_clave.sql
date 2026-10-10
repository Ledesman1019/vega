-- =====================================================================
--  VEGA · Importar productos desde la app, protegido con CLAVE
--
--  La app sigue SIN permiso para escribir en la tabla productos. La única
--  forma de cargar productos es la función importar_productos(), que:
--    1) exige la clave de administrador (se guarda cifrada, nadie la ve)
--    2) NUNCA duplica: el estilo es la llave única.
--         - estilo nuevo                      -> se AGREGA
--         - estilo existente, otra descripción -> se ACTUALIZA
--         - estilo existente, igual           -> NO se toca
--    3) NO borra productos que no vengan en el Excel.
--
--  Cómo usarlo:
--    1) Ejecuta primero 01_schema.sql (si no lo hiciste).
--    2) Cambia 'CAMBIA-ESTA-CLAVE' (AL FINAL del archivo) por tu clave y ejecuta
--       TODO este archivo en Supabase > SQL Editor.
--    3) Para cambiar la clave después, ejecuta solo:
--         select privado.cambiar_clave('mi-nueva-clave');
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Esquema privado: NO está expuesto por la API, la app no lo puede leer
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table if not exists privado.config (
  id          int primary key default 1 check (id = 1),
  clave_hash  text not null,
  updated_at  timestamptz not null default now()
);
revoke all on privado.config from public, anon, authenticated;

create or replace function privado.cambiar_clave(p_clave text)
returns void
language plpgsql
security definer
set search_path = privado, extensions, public
as $$
begin
  if p_clave is null or length(p_clave) < 6 then
    raise exception 'La clave debe tener al menos 6 caracteres.';
  end if;
  if p_clave = 'CAMBIA-ESTA-CLAVE' then
    raise exception 'Cambia CAMBIA-ESTA-CLAVE por tu propia clave al final del archivo y vuelve a ejecutarlo.';
  end if;
  insert into privado.config (id, clave_hash, updated_at)
  values (1, extensions.crypt(p_clave, extensions.gen_salt('bf')), now())
  on conflict (id) do update set clave_hash = excluded.clave_hash, updated_at = now();
end $$;
revoke all on function privado.cambiar_clave(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- importar_productos(clave, productos, aplicar)
--   productos: [{"estilo":"010247","descripcion":"SAPOLIO ..."}, ...]
--   aplicar = false -> solo CUENTA (vista previa), no escribe nada
--   aplicar = true  -> guarda los cambios
--   Devuelve: {"nuevos": n, "actualizados": n, "sin_cambios": n}
-- ---------------------------------------------------------------------
create or replace function public.importar_productos(
  p_clave text,
  p_productos jsonb,
  p_aplicar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, privado, extensions
as $$
declare
  v_hash text;
  v_nuevos int;
  v_actualizados int;
  v_sin_cambios int;
begin
  select clave_hash into v_hash from privado.config where id = 1;
  if v_hash is null or p_clave is null or extensions.crypt(p_clave, v_hash) <> v_hash then
    perform pg_sleep(1); -- frena intentos de adivinar la clave
    raise exception 'Clave incorrecta.' using errcode = '28P01';
  end if;

  if jsonb_typeof(p_productos) <> 'array' or jsonb_array_length(p_productos) > 5000 then
    raise exception 'Envía como máximo 5000 productos por lote.';
  end if;

  create temporary table if not exists _imp (estilo text primary key, descripcion text not null) on commit drop;
  truncate _imp;

  -- Limpia y quita repetidos dentro del mismo archivo (se queda el último)
  insert into _imp (estilo, descripcion)
  select distinct on (estilo) estilo, descripcion
  from (
    select upper(btrim(e.item ->> 'estilo')) as estilo,
           regexp_replace(btrim(e.item ->> 'descripcion'), '\s+', ' ', 'g') as descripcion,
           e.ord
    from jsonb_array_elements(p_productos) with ordinality as e(item, ord)
  ) s
  where estilo ~ '^[0-9A-Z-]{1,20}$' and length(descripcion) > 0
  order by estilo, ord desc;

  select count(*) filter (where p.estilo is null),
         count(*) filter (where p.estilo is not null and p.descripcion is distinct from i.descripcion),
         count(*) filter (where p.estilo is not null and p.descripcion = i.descripcion)
    into v_nuevos, v_actualizados, v_sin_cambios
  from _imp i
  left join public.productos p on p.estilo = i.estilo;

  if p_aplicar then
    insert into public.productos (estilo, descripcion)
    select estilo, descripcion from _imp
    on conflict (estilo) do update
      set descripcion = excluded.descripcion
      where productos.descripcion is distinct from excluded.descripcion;
  end if;

  return jsonb_build_object('nuevos', v_nuevos, 'actualizados', v_actualizados, 'sin_cambios', v_sin_cambios);
end $$;

revoke all on function public.importar_productos(text, jsonb, boolean) from public;
grant execute on function public.importar_productos(text, jsonb, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

-- 👇👇 PON AQUÍ TU CLAVE ANTES DE EJECUTAR (mínimo 6 caracteres) 👇👇
select privado.cambiar_clave('CAMBIA-ESTA-CLAVE');
