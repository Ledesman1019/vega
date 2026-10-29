-- =====================================================================
--  VEGA · Ingresos: detalle por fila (descripción y fecha de vencimiento)
--  y botón "Eliminar ingreso".
--
--  - ingresos_detalle: cada fila del Excel del ingreso (estilo,
--    descripción, cantidad y fecha de vencimiento).
--  - eliminar_ingreso(): borra el ingreso y su detalle para no ocupar
--    espacio. Los rótulos automáticos ya generados NO se borran (quedan
--    en pendientes/impresos, solo pierden el enlace al ingreso).
--
--  Cómo usarlo:
--    Ejecuta antes 06_rotulo_automatico.sql. Luego pega TODO este archivo
--    en Supabase > SQL Editor > Run. Aquí NO se escribe ninguna clave.
-- =====================================================================

create table if not exists public.ingresos_detalle (
  id                 bigint generated always as identity primary key,
  ingreso_id         bigint not null references public.ingresos (id) on delete cascade,
  fila               integer,
  estilo             text not null,
  descripcion        text,
  cantidad           bigint not null check (cantidad > 0),
  fecha_vencimiento  date
);
create index if not exists ingresos_detalle_ingreso_idx on public.ingresos_detalle (ingreso_id);

alter table public.ingresos_detalle enable row level security;
drop policy if exists "ingresos_detalle_select" on public.ingresos_detalle;
create policy "ingresos_detalle_select" on public.ingresos_detalle for select to anon, authenticated using (true);
grant select on public.ingresos_detalle to anon, authenticated;
revoke insert, update, delete, truncate on public.ingresos_detalle from anon, authenticated;

-- Los rótulos sobreviven al borrar su ingreso
alter table public.rotulos_automaticos alter column ingreso_id drop not null;
alter table public.rotulos_automaticos drop constraint if exists rotulos_automaticos_ingreso_id_fkey;
alter table public.rotulos_automaticos
  add constraint rotulos_automaticos_ingreso_id_fkey
  foreign key (ingreso_id) references public.ingresos (id) on delete set null;


-- Fecha 'YYYY-MM-DD' -> date; null si viene vacía o no es una fecha real
create or replace function privado.fecha_segura(p text)
returns date
language plpgsql
immutable
as $$
begin
  if p is null or btrim(p) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return null;
  end if;
  return btrim(p)::date;
exception when others then
  return null;
end $$;
revoke all on function privado.fecha_segura(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- registrar_ingreso(clave, items, nota, aplicar)  — reemplaza la del 06
--   items: [{"fila":2,"estilo":"290186","descripcion":"ANGEL ...",
--            "cantidad":600,"fecha":"2030-05-19"}, ...]
--   (cantidad en UNIDADES; descripción y fecha son opcionales)
--   El cálculo no cambia: el mismo estilo se SUMA; un rótulo por pallet
--   completo. Además guarda cada fila en ingresos_detalle y devuelve por
--   producto las fechas de vencimiento que trae ("fechas").
-- ---------------------------------------------------------------------
create or replace function public.registrar_ingreso(p_clave text, p_items jsonb, p_nota text default null, p_aplicar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, privado, extensions
as $$
declare
  v_total int;
  v_validos int;
  v_detalle jsonb;
  v_productos int;
  v_rotulos int;
  v_ingreso bigint;
begin
  perform privado.exigir_clave(p_clave);

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El ingreso no tiene productos.';
  end if;
  if jsonb_array_length(p_items) > 5000 then
    raise exception 'Envía como máximo 5000 filas por ingreso.';
  end if;
  v_total := jsonb_array_length(p_items);

  -- Filas válidas (cantidad: solo enteros positivos)
  create temporary table if not exists _filas (
    ord bigint, fila int, estilo text, descripcion text, cantidad bigint, fecha date
  ) on commit drop;
  truncate _filas;

  insert into _filas (ord, fila, estilo, descripcion, cantidad, fecha)
  select s.ord,
         case when s.fila ~ '^[0-9]{1,9}$' then s.fila::int end,
         s.estilo,
         nullif(s.descripcion, ''),
         s.cantidad::bigint,
         privado.fecha_segura(s.fecha)
  from (
    select e.ord,
           btrim(e.item ->> 'fila') as fila,
           upper(btrim(e.item ->> 'estilo')) as estilo,
           regexp_replace(btrim(coalesce(e.item ->> 'descripcion', '')), '\s+', ' ', 'g') as descripcion,
           btrim(e.item ->> 'cantidad') as cantidad,
           e.item ->> 'fecha' as fecha
    from jsonb_array_elements(p_items) with ordinality as e(item, ord)
  ) s
  where s.estilo ~ '^[0-9A-Z-]{1,20}$'
    and case when s.cantidad ~ '^[0-9]{1,12}$' then s.cantidad::bigint > 0 else false end;

  select count(*) into v_validos from _filas;
  if v_validos = 0 then
    raise exception 'Ninguna fila tiene estilo y cantidad válidos.';
  end if;

  -- El cálculo por producto (división entera y resto, todo en enteros)
  select jsonb_agg(d order by d ->> 'estilo'),
         count(*),
         coalesce(sum((d ->> 'pallets')::int), 0)
    into v_detalle, v_productos, v_rotulos
  from (
    select jsonb_build_object(
      'estilo', i.estilo,
      'descripcion', coalesce(p.descripcion, pr.descripcion, i.descripcion, ''),
      'recibido', i.recibido,
      'fechas', i.fechas,
      'factor', p.factor,
      'cama', p.cama,
      'altura', p.altura,
      'total', p.total,
      'por_pallet', p.unidades_pallet,
      'pallets', case when p.estilo is null then 0 else i.recibido / p.unidades_pallet end,
      'saldo', case when p.estilo is null then i.recibido else i.recibido % p.unidades_pallet end,
      'faltan', case when p.estilo is not null and i.recibido < p.unidades_pallet then p.unidades_pallet - i.recibido end,
      'estado', case
                  when p.estilo is null then 'sin_config'
                  when i.recibido >= p.unidades_pallet then 'genera'
                  else 'incompleto'
                end
    ) as d
    from (
      select estilo,
             -- sum(bigint) devuelve numeric: se vuelve a entero para que
             -- la división sea ENTERA (pallets completos) y no decimal
             sum(cantidad)::bigint as recibido,
             (array_agg(descripcion order by ord) filter (where descripcion is not null))[1] as descripcion,
             coalesce(jsonb_agg(distinct to_char(fecha, 'YYYY-MM-DD')) filter (where fecha is not null), '[]'::jsonb) as fechas
      from _filas
      group by estilo
    ) i
    left join public.paletizado p on p.estilo = i.estilo
    left join public.productos pr on pr.estilo = i.estilo
  ) x;

  if v_rotulos > 1000 then
    raise exception 'El ingreso generaría % rótulos (máximo 1000). Revisa las cantidades: deben estar en UNIDADES.', v_rotulos;
  end if;

  if p_aplicar then
    insert into public.ingresos (nota, productos, rotulos, detalle)
    values (nullif(btrim(coalesce(p_nota, '')), ''), v_productos, v_rotulos, v_detalle)
    returning id into v_ingreso;

    insert into public.ingresos_detalle (ingreso_id, fila, estilo, descripcion, cantidad, fecha_vencimiento)
    select v_ingreso, fila, estilo, descripcion, cantidad, fecha from _filas order by ord;

    -- Un rótulo por cada pallet completo
    insert into public.rotulos_automaticos (ingreso_id, estilo, descripcion, cajas, unidades, pallet_num, pallets_total)
    select v_ingreso, d ->> 'estilo', d ->> 'descripcion', (d ->> 'total')::int, (d ->> 'por_pallet')::bigint, n, (d ->> 'pallets')::int
    from jsonb_array_elements(v_detalle) as d
    cross join lateral generate_series(1, (d ->> 'pallets')::int) as n
    where d ->> 'estado' = 'genera';
  end if;

  return jsonb_build_object(
    'ingreso_id', v_ingreso,
    'productos', v_productos,
    'rotulos', v_rotulos,
    'invalidos', v_total - v_validos,
    'detalle', v_detalle
  );
end $$;

revoke all on function public.registrar_ingreso(text, jsonb, text, boolean) from public;
grant execute on function public.registrar_ingreso(text, jsonb, text, boolean) to anon, authenticated;


-- ---------------------------------------------------------------------
-- eliminar_ingreso(clave, id): borra el ingreso y su detalle.
-- Los rótulos automáticos generados se conservan.
-- ---------------------------------------------------------------------
create or replace function public.eliminar_ingreso(p_clave text, p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, privado, extensions
as $$
begin
  perform privado.exigir_clave(p_clave);
  delete from public.ingresos where id = p_id;
  return found;
end $$;

revoke all on function public.eliminar_ingreso(text, bigint) from public;
grant execute on function public.eliminar_ingreso(text, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
