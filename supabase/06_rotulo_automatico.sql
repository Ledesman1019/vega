-- =====================================================================
--  VEGA · Rótulo automático
--
--  1) PALETIZADO: por producto, factor (unidades por caja), cama (cajas
--     por nivel) y altura (niveles).
--        total            = cama × altura          (cajas por pallet)
--        unidades_pallet  = factor × cama × altura (unidades por pallet)
--  2) INGRESOS: cantidad recibida (en UNIDADES) por producto. Si un
--     producto se repite en el ingreso, se SUMA.
--        pallets completos = recibido ÷ unidades_pallet (división entera)
--        saldo             = recibido − pallets × unidades_pallet
--     Por cada pallet completo se genera UN rótulo automático con
--     CANT. = total (cajas del pallet), pendiente de fecha de vencimiento.
--
--  Todo el cálculo se hace AQUÍ, con números enteros: la vista previa de
--  la app y lo que se guarda salen del mismo cálculo.
--
--  Cómo usarlo:
--    Ejecuta antes 01, 02 y 05. Luego pega TODO este archivo en
--    Supabase > SQL Editor > Run. Aquí NO se escribe ninguna clave.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clave de administrador (la misma de la importación)
-- ---------------------------------------------------------------------
create or replace function privado.exigir_clave(p_clave text)
returns void
language plpgsql
security definer
set search_path = privado, extensions, public
as $$
declare
  v_hash text;
begin
  select clave_hash into v_hash from privado.config where id = 1;
  if v_hash is null or p_clave is null or extensions.crypt(p_clave, v_hash) <> v_hash then
    perform pg_sleep(1); -- frena intentos de adivinar la clave
    raise exception 'Clave incorrecta.' using errcode = '28P01';
  end if;
end $$;
revoke all on function privado.exigir_clave(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 1) PALETIZADO
-- ---------------------------------------------------------------------
create table if not exists public.paletizado (
  estilo           text primary key,
  descripcion      text not null,
  factor           integer not null,
  cama             integer not null,
  altura           integer not null,
  total            integer generated always as (cama * altura) stored,
  unidades_pallet  bigint  generated always as (factor::bigint * cama * altura) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint paletizado_estilo_valido check (estilo ~ '^[0-9A-Z-]{1,20}$'),
  constraint paletizado_descripcion_valida check (length(btrim(descripcion)) > 0),
  constraint paletizado_factor_valido check (factor between 1 and 100000),
  constraint paletizado_cama_valida check (cama between 1 and 1000),
  constraint paletizado_altura_valida check (altura between 1 and 1000)
);

drop trigger if exists paletizado_set_updated_at on public.paletizado;
create trigger paletizado_set_updated_at
  before update on public.paletizado
  for each row execute function public.tg_set_updated_at();


-- ---------------------------------------------------------------------
-- 2) INGRESOS y RÓTULOS AUTOMÁTICOS
-- ---------------------------------------------------------------------
create table if not exists public.ingresos (
  id          bigint generated always as identity primary key,
  nota        text,
  productos   integer not null,
  rotulos     integer not null,
  detalle     jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists ingresos_created_idx on public.ingresos (created_at desc);

create table if not exists public.rotulos_automaticos (
  id                 bigint generated always as identity primary key,
  ingreso_id         bigint not null references public.ingresos (id) on delete cascade,
  estilo             text not null,
  descripcion        text not null,
  cajas              integer not null check (cajas > 0),   -- CANT. del rótulo
  unidades           bigint not null check (unidades > 0), -- unidades del pallet
  pallet_num         integer not null check (pallet_num > 0),
  pallets_total      integer not null check (pallets_total >= pallet_num),
  fecha_vencimiento  date,
  estado             text not null default 'pendiente' check (estado in ('pendiente', 'impreso', 'anulado')),
  impreso_at         timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists rotulos_automaticos_estado_idx on public.rotulos_automaticos (estado, created_at desc);
create index if not exists rotulos_automaticos_ingreso_idx on public.rotulos_automaticos (ingreso_id);


-- ---------------------------------------------------------------------
-- 3) SEGURIDAD: la app solo puede LEER; todo cambio pasa por las
--    funciones de abajo, que exigen la clave.
-- ---------------------------------------------------------------------
alter table public.paletizado          enable row level security;
alter table public.ingresos            enable row level security;
alter table public.rotulos_automaticos enable row level security;

drop policy if exists "paletizado_select" on public.paletizado;
create policy "paletizado_select" on public.paletizado for select to anon, authenticated using (true);
drop policy if exists "ingresos_select" on public.ingresos;
create policy "ingresos_select" on public.ingresos for select to anon, authenticated using (true);
drop policy if exists "rotulos_automaticos_select" on public.rotulos_automaticos;
create policy "rotulos_automaticos_select" on public.rotulos_automaticos for select to anon, authenticated using (true);

grant select on public.paletizado, public.ingresos, public.rotulos_automaticos to anon, authenticated;
revoke insert, update, delete, truncate on public.paletizado, public.ingresos, public.rotulos_automaticos from anon, authenticated;


-- ---------------------------------------------------------------------
-- guardar_paletizado(clave, items, aplicar)
--   items: [{"estilo","descripcion","factor","cama","altura"}, ...]
--   Sin descripción se toma la de la tabla productos.
--   aplicar = false -> solo cuenta (vista previa)
--   Devuelve {"nuevos","actualizados","sin_cambios","invalidos"}
-- ---------------------------------------------------------------------
create or replace function public.guardar_paletizado(p_clave text, p_items jsonb, p_aplicar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, privado, extensions
as $$
declare
  v_total int;
  v_nuevos int;
  v_actualizados int;
  v_sin_cambios int;
begin
  perform privado.exigir_clave(p_clave);

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 5000 then
    raise exception 'Envía como máximo 5000 productos por lote.';
  end if;
  v_total := jsonb_array_length(p_items);

  create temporary table if not exists _pal (
    estilo text primary key, descripcion text not null, factor int not null, cama int not null, altura int not null
  ) on commit drop;
  truncate _pal;

  -- Solo enteros positivos dentro de rango; repetidos: se queda el último
  insert into _pal (estilo, descripcion, factor, cama, altura)
  select distinct on (s.estilo) s.estilo, coalesce(nullif(s.descripcion, ''), pr.descripcion), s.factor::int, s.cama::int, s.altura::int
  from (
    select upper(btrim(e.item ->> 'estilo')) as estilo,
           regexp_replace(btrim(coalesce(e.item ->> 'descripcion', '')), '\s+', ' ', 'g') as descripcion,
           btrim(e.item ->> 'factor') as factor,
           btrim(e.item ->> 'cama') as cama,
           btrim(e.item ->> 'altura') as altura,
           e.ord
    from jsonb_array_elements(p_items) with ordinality as e(item, ord)
  ) s
  left join public.productos pr on pr.estilo = s.estilo
  -- (CASE: Postgres no garantiza el orden del AND; así nunca convierte texto inválido)
  where s.estilo ~ '^[0-9A-Z-]{1,20}$'
    and case when s.factor ~ '^[0-9]{1,6}$' then s.factor::int between 1 and 100000 else false end
    and case when s.cama   ~ '^[0-9]{1,4}$' then s.cama::int   between 1 and 1000   else false end
    and case when s.altura ~ '^[0-9]{1,4}$' then s.altura::int between 1 and 1000   else false end
    and length(coalesce(nullif(s.descripcion, ''), pr.descripcion, '')) > 0
  order by s.estilo, s.ord desc;

  select count(*) filter (where p.estilo is null),
         count(*) filter (where p.estilo is not null and (p.descripcion, p.factor, p.cama, p.altura) is distinct from (i.descripcion, i.factor, i.cama, i.altura)),
         count(*) filter (where p.estilo is not null and (p.descripcion, p.factor, p.cama, p.altura) = (i.descripcion, i.factor, i.cama, i.altura))
    into v_nuevos, v_actualizados, v_sin_cambios
  from _pal i
  left join public.paletizado p on p.estilo = i.estilo;

  if p_aplicar then
    insert into public.paletizado (estilo, descripcion, factor, cama, altura)
    select estilo, descripcion, factor, cama, altura from _pal
    on conflict (estilo) do update
      set descripcion = excluded.descripcion, factor = excluded.factor, cama = excluded.cama, altura = excluded.altura
      where (paletizado.descripcion, paletizado.factor, paletizado.cama, paletizado.altura)
            is distinct from (excluded.descripcion, excluded.factor, excluded.cama, excluded.altura);
  end if;

  return jsonb_build_object(
    'nuevos', v_nuevos,
    'actualizados', v_actualizados,
    'sin_cambios', v_sin_cambios,
    'invalidos', v_total - v_nuevos - v_actualizados - v_sin_cambios
  );
end $$;

revoke all on function public.guardar_paletizado(text, jsonb, boolean) from public;
grant execute on function public.guardar_paletizado(text, jsonb, boolean) to anon, authenticated;


create or replace function public.borrar_paletizado(p_clave text, p_estilo text)
returns void
language plpgsql
security definer
set search_path = public, privado, extensions
as $$
begin
  perform privado.exigir_clave(p_clave);
  delete from public.paletizado where estilo = upper(btrim(p_estilo));
end $$;

revoke all on function public.borrar_paletizado(text, text) from public;
grant execute on function public.borrar_paletizado(text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- registrar_ingreso(clave, items, nota, aplicar)
--   items: [{"estilo":"134214","cantidad":1920}, ...]  (cantidad en UNIDADES)
--   aplicar = false -> solo calcula (vista previa), no guarda nada
--   aplicar = true  -> guarda el ingreso y genera los rótulos
--   Devuelve {"ingreso_id","productos","rotulos","invalidos","detalle":[...]}
--   detalle por producto: estilo, descripcion, recibido, factor, cama,
--   altura, total, por_pallet, pallets, saldo, faltan, estado
--   (genera | incompleto | sin_config)
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

  create temporary table if not exists _ing (estilo text primary key, recibido bigint not null) on commit drop;
  truncate _ing;

  -- Cantidades: solo enteros positivos. El mismo estilo se SUMA.
  insert into _ing (estilo, recibido)
  select estilo, sum(cantidad::bigint)
  from (
    select upper(btrim(e.item ->> 'estilo')) as estilo, btrim(e.item ->> 'cantidad') as cantidad
    from jsonb_array_elements(p_items) as e(item)
  ) s
  where estilo ~ '^[0-9A-Z-]{1,20}$'
    and case when cantidad ~ '^[0-9]{1,12}$' then cantidad::bigint > 0 else false end
  group by estilo;

  select count(*) into v_validos
  from jsonb_array_elements(p_items) as e(item)
  where upper(btrim(e.item ->> 'estilo')) ~ '^[0-9A-Z-]{1,20}$'
    and case when btrim(e.item ->> 'cantidad') ~ '^[0-9]{1,12}$' then btrim(e.item ->> 'cantidad')::bigint > 0 else false end;

  if v_validos = 0 then
    raise exception 'Ninguna fila tiene estilo y cantidad válidos.';
  end if;

  -- El cálculo (división entera y resto, todo en enteros)
  select jsonb_agg(d order by d ->> 'estilo'),
         count(*),
         coalesce(sum((d ->> 'pallets')::int), 0)
    into v_detalle, v_productos, v_rotulos
  from (
    select jsonb_build_object(
      'estilo', i.estilo,
      'descripcion', coalesce(p.descripcion, pr.descripcion, ''),
      'recibido', i.recibido,
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
    from _ing i
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
-- actualizar_rotulos_auto(clave, ids, fecha, estado)
--   Pone la fecha de vencimiento y/o cambia el estado
--   (pendiente | impreso | anulado) de varios rótulos a la vez.
-- ---------------------------------------------------------------------
create or replace function public.actualizar_rotulos_auto(
  p_clave text,
  p_ids bigint[],
  p_fecha date default null,
  p_estado text default null
)
returns integer
language plpgsql
security definer
set search_path = public, privado, extensions
as $$
declare
  v_n int;
begin
  perform privado.exigir_clave(p_clave);
  if p_estado is not null and p_estado not in ('pendiente', 'impreso', 'anulado') then
    raise exception 'Estado no válido.';
  end if;

  update public.rotulos_automaticos
     set fecha_vencimiento = coalesce(p_fecha, fecha_vencimiento),
         estado = coalesce(p_estado, estado),
         impreso_at = case when p_estado = 'impreso' then now()
                           when p_estado is not null then null
                           else impreso_at end
   where id = any(p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.actualizar_rotulos_auto(text, bigint[], date, text) from public;
grant execute on function public.actualizar_rotulos_auto(text, bigint[], date, text) to anon, authenticated;

notify pgrst, 'reload schema';
