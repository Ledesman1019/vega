-- =====================================================================
--  VEGA · Paletizado con campos vacíos
--
--  Ahora se suben TODOS los productos del Excel, tengan o no factor,
--  cama y altura (se irán completando poco a poco):
--    - factor, cama y altura pueden quedar VACÍOS (null).
--    - total y unidades por pallet quedan vacíos si falta algún dato.
--    - Al volver a importar, una celda VACÍA en el Excel NO borra el
--      dato que ya está guardado (solo se escribe lo que trae valor).
--    - En un ingreso, un producto con paletizado incompleto no genera
--      rótulos (sale como "sin paletizado", igual que si no existiera).
--
--  Cómo usarlo:
--    Ejecuta antes 06 a 10. Luego pega TODO este archivo en
--    Supabase > SQL Editor > Run. Aquí NO se escribe ninguna clave.
-- =====================================================================

alter table public.paletizado alter column factor drop not null;
alter table public.paletizado alter column cama   drop not null;
alter table public.paletizado alter column altura drop not null;
-- (las reglas "entre 1 y 1000" siguen valiendo cuando hay un valor)


-- ---------------------------------------------------------------------
-- guardar_paletizado: igual que antes (compara y nunca duplica), pero
-- acepta campos vacíos y no pisa un dato guardado con uno vacío.
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
  v_cambios jsonb;
begin
  perform privado.exigir_clave(p_clave);

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 5000 then
    raise exception 'Envía como máximo 5000 productos por lote.';
  end if;
  v_total := jsonb_array_length(p_items);

  create temporary table if not exists _pal_raw (
    ord bigint, estilo text, descripcion text, factor int, cama int, altura int
  ) on commit drop;
  truncate _pal_raw;
  create temporary table if not exists _pal (
    estilo text primary key, descripcion text not null, factor int, cama int, altura int
  ) on commit drop;
  truncate _pal;

  -- Filas válidas: cada número vacío o entero positivo dentro de rango
  insert into _pal_raw (ord, estilo, descripcion, factor, cama, altura)
  select s.ord, s.estilo, coalesce(nullif(s.descripcion, ''), pr.descripcion),
         case when s.factor <> '' then s.factor::int end,
         case when s.cama   <> '' then s.cama::int end,
         case when s.altura <> '' then s.altura::int end
  from (
    select upper(btrim(e.item ->> 'estilo')) as estilo,
           regexp_replace(btrim(coalesce(e.item ->> 'descripcion', '')), '\s+', ' ', 'g') as descripcion,
           coalesce(btrim(e.item ->> 'factor'), '') as factor,
           coalesce(btrim(e.item ->> 'cama'), '') as cama,
           coalesce(btrim(e.item ->> 'altura'), '') as altura,
           e.ord
    from jsonb_array_elements(p_items) with ordinality as e(item, ord)
  ) s
  left join public.productos pr on pr.estilo = s.estilo
  -- (CASE: Postgres no garantiza el orden del AND; así nunca convierte texto inválido)
  where s.estilo ~ '^[0-9A-Z-]{1,20}$'
    and case when s.factor = '' then true when s.factor ~ '^[0-9]{1,6}$' then s.factor::int between 1 and 100000 else false end
    and case when s.cama   = '' then true when s.cama   ~ '^[0-9]{1,4}$' then s.cama::int   between 1 and 1000   else false end
    and case when s.altura = '' then true when s.altura ~ '^[0-9]{1,4}$' then s.altura::int between 1 and 1000   else false end
    and length(coalesce(nullif(s.descripcion, ''), pr.descripcion, '')) > 0;

  -- Un solo registro por estilo (llave primaria): si se repite, gana la última fila
  insert into _pal (estilo, descripcion, factor, cama, altura)
  select distinct on (estilo) estilo, descripcion, factor, cama, altura
  from _pal_raw
  order by estilo, ord desc;

  -- Lo que quedará guardado: lo que trae el Excel; si viene vacío, lo que ya había
  create temporary table if not exists _pal_fin (
    estilo text primary key, existe boolean, descripcion text, factor int, cama int, altura int,
    a_descripcion text, a_factor int, a_cama int, a_altura int
  ) on commit drop;
  truncate _pal_fin;
  insert into _pal_fin
  select i.estilo, p.estilo is not null, i.descripcion,
         coalesce(i.factor, p.factor), coalesce(i.cama, p.cama), coalesce(i.altura, p.altura),
         p.descripcion, p.factor, p.cama, p.altura
  from _pal i
  left join public.paletizado p on p.estilo = i.estilo;

  select count(*) filter (where not existe),
         count(*) filter (where existe and (a_descripcion, a_factor, a_cama, a_altura) is distinct from (descripcion, factor, cama, altura)),
         count(*) filter (where existe and (a_descripcion, a_factor, a_cama, a_altura) is not distinct from (descripcion, factor, cama, altura))
    into v_nuevos, v_actualizados, v_sin_cambios
  from _pal_fin;

  -- Detalle de lo que se agrega o cambia (máximo 1000 para mostrar)
  select coalesce(jsonb_agg(c order by c ->> 'tipo' desc, c ->> 'estilo'), '[]'::jsonb)
    into v_cambios
  from (
    select jsonb_build_object(
             'estilo', estilo,
             'tipo', case when existe then 'actualiza' else 'nuevo' end,
             'antes', case when existe then jsonb_build_object('descripcion', a_descripcion, 'factor', a_factor, 'cama', a_cama, 'altura', a_altura) end,
             'despues', jsonb_build_object('descripcion', descripcion, 'factor', factor, 'cama', cama, 'altura', altura)
           ) as c
    from _pal_fin
    where not existe
       or (a_descripcion, a_factor, a_cama, a_altura) is distinct from (descripcion, factor, cama, altura)
    order by existe, estilo
    limit 1000
  ) x;

  if p_aplicar then
    insert into public.paletizado (estilo, descripcion, factor, cama, altura)
    select estilo, descripcion, factor, cama, altura from _pal_fin
    on conflict (estilo) do update
      set descripcion = excluded.descripcion, factor = excluded.factor, cama = excluded.cama, altura = excluded.altura
      where (paletizado.descripcion, paletizado.factor, paletizado.cama, paletizado.altura)
            is distinct from (excluded.descripcion, excluded.factor, excluded.cama, excluded.altura);
  end if;

  return jsonb_build_object(
    'nuevos', v_nuevos,
    'actualizados', v_actualizados,
    'sin_cambios', v_sin_cambios,
    'invalidos', v_total - (select count(*) from _pal_raw),
    'repetidos', (select count(*) from _pal_raw) - (select count(*) from _pal),
    'cambios', v_cambios
  );
end $$;

revoke all on function public.guardar_paletizado(text, jsonb, boolean) from public;
grant execute on function public.guardar_paletizado(text, jsonb, boolean) to anon, authenticated;


-- ---------------------------------------------------------------------
-- registrar_ingreso: igual que en 07, pero un producto con paletizado
-- incompleto (falta factor, cama o altura) cuenta como "sin_config" y
-- no genera rótulos.
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

  -- El cálculo por producto (división entera y resto, todo en enteros).
  -- Solo con paletizado completo (unidades_pallet con valor) se calculan pallets.
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
      'pallets', case when p.unidades_pallet is null then 0 else i.recibido / p.unidades_pallet end,
      'saldo', case when p.unidades_pallet is null then i.recibido else i.recibido % p.unidades_pallet end,
      'faltan', case when p.unidades_pallet is not null and i.recibido < p.unidades_pallet then p.unidades_pallet - i.recibido end,
      'estado', case
                  when p.unidades_pallet is null then 'sin_config'
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

notify pgrst, 'reload schema';
