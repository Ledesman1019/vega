-- =====================================================================
--  VEGA · Códigos de barras (EAN-13) para el escáner del rótulo
--
--  Cada código de barras apunta a un estilo de la tabla productos. Un
--  mismo estilo puede tener VARIOS códigos (por ejemplo, unidad y pack).
--
--  Cómo usarlo:
--    Ejecuta primero 01_schema.sql y 02_importar_con_clave.sql.
--    Luego pega TODO este archivo en Supabase > SQL Editor > Run.
--    Aquí NO se escribe ninguna clave (usa la misma de la importación).
-- =====================================================================

create table if not exists public.productos_ean (
  ean         text primary key,
  estilo      text not null references public.productos (estilo) on update cascade on delete cascade,
  created_at  timestamptz not null default now(),
  constraint productos_ean_valido check (ean ~ '^[0-9]{8,14}$')
);

create index if not exists productos_ean_estilo_idx on public.productos_ean (estilo);

-- Seguridad: la app solo puede LEER. Cargar códigos se hace con la
-- función importar_eans() (exige la clave) o desde el panel de Supabase.
alter table public.productos_ean enable row level security;

drop policy if exists "productos_ean_select" on public.productos_ean;
create policy "productos_ean_select" on public.productos_ean for select to anon, authenticated using (true);

grant select on public.productos_ean to anon, authenticated;
revoke insert, update, delete, truncate on public.productos_ean from anon, authenticated;


-- ---------------------------------------------------------------------
-- importar_eans(clave, codigos, aplicar)
--   codigos: [{"ean":"7750243012345","estilo":"010247"}, ...]
--   aplicar = false -> solo CUENTA (vista previa), no escribe nada
--   aplicar = true  -> guarda los cambios
--   Nunca duplica: el código es la llave única.
--     - código nuevo                    -> se AGREGA
--     - código existente, otro estilo   -> se ACTUALIZA
--     - código existente, mismo estilo  -> NO se toca
--   Los códigos de estilos que no existen en productos se omiten.
--   Devuelve: {"nuevos": n, "actualizados": n, "sin_cambios": n, "sin_producto": n}
-- ---------------------------------------------------------------------
create or replace function public.importar_eans(
  p_clave text,
  p_codigos jsonb,
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
  v_sin_producto int;
begin
  select clave_hash into v_hash from privado.config where id = 1;
  if v_hash is null or p_clave is null or extensions.crypt(p_clave, v_hash) <> v_hash then
    perform pg_sleep(1); -- frena intentos de adivinar la clave
    raise exception 'Clave incorrecta.' using errcode = '28P01';
  end if;

  if jsonb_typeof(p_codigos) <> 'array' or jsonb_array_length(p_codigos) > 5000 then
    raise exception 'Envía como máximo 5000 códigos por lote.';
  end if;

  create temporary table if not exists _imp_ean (ean text primary key, estilo text not null) on commit drop;
  truncate _imp_ean;

  -- Limpia y quita repetidos dentro del mismo archivo (se queda el último)
  insert into _imp_ean (ean, estilo)
  select distinct on (ean) ean, estilo
  from (
    select btrim(e.item ->> 'ean') as ean,
           upper(btrim(e.item ->> 'estilo')) as estilo,
           e.ord
    from jsonb_array_elements(p_codigos) with ordinality as e(item, ord)
  ) s
  where ean ~ '^[0-9]{8,14}$' and estilo ~ '^[0-9A-Z-]{1,20}$'
  order by ean, ord desc;

  -- En la vista previa los productos nuevos del mismo Excel aún no existen,
  -- por eso "sin_producto" solo se informa al aplicar.
  select count(*) filter (where e.ean is null),
         count(*) filter (where e.ean is not null and e.estilo is distinct from i.estilo),
         count(*) filter (where e.ean is not null and e.estilo = i.estilo)
    into v_nuevos, v_actualizados, v_sin_cambios
  from _imp_ean i
  left join public.productos_ean e on e.ean = i.ean;

  v_sin_producto := 0;
  if p_aplicar then
    select count(*) into v_sin_producto
    from _imp_ean i
    where not exists (select 1 from public.productos p where p.estilo = i.estilo);

    insert into public.productos_ean (ean, estilo)
    select i.ean, i.estilo from _imp_ean i
    where exists (select 1 from public.productos p where p.estilo = i.estilo)
    on conflict (ean) do update
      set estilo = excluded.estilo
      where productos_ean.estilo is distinct from excluded.estilo;
  end if;

  return jsonb_build_object(
    'nuevos', v_nuevos,
    'actualizados', v_actualizados,
    'sin_cambios', v_sin_cambios,
    'sin_producto', v_sin_producto
  );
end $$;

revoke all on function public.importar_eans(text, jsonb, boolean) from public;
grant execute on function public.importar_eans(text, jsonb, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
