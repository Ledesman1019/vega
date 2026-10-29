-- =====================================================================
--  VEGA · Paletizado: comparar antes de actualizar
--
--  El ESTILO es la llave primaria de paletizado: nunca se duplica.
--  Al importar o guardar:
--    - estilo nuevo                         -> se AGREGA
--    - estilo existente con algún cambio    -> se ACTUALIZAN sus campos
--    - estilo existente igual               -> NO se toca
--    - el mismo estilo repetido en el Excel -> se toma la última fila
--  Ahora además devuelve "cambios": qué estilos se agregan o actualizan y
--  el valor antes / después de cada campo, para revisarlo en la app; y
--  separa los "repetidos" (mismo estilo en el archivo) de los "invalidos".
--
--  Cómo usarlo:
--    Pega TODO este archivo en Supabase > SQL Editor > Run.
-- =====================================================================

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
    estilo text primary key, descripcion text not null, factor int not null, cama int not null, altura int not null
  ) on commit drop;
  truncate _pal;

  -- Filas válidas: solo enteros positivos dentro de rango
  insert into _pal_raw (ord, estilo, descripcion, factor, cama, altura)
  select s.ord, s.estilo, coalesce(nullif(s.descripcion, ''), pr.descripcion), s.factor::int, s.cama::int, s.altura::int
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
    and length(coalesce(nullif(s.descripcion, ''), pr.descripcion, '')) > 0;

  -- Un solo registro por estilo (llave primaria): si se repite, gana la última fila
  insert into _pal (estilo, descripcion, factor, cama, altura)
  select distinct on (estilo) estilo, descripcion, factor, cama, altura
  from _pal_raw
  order by estilo, ord desc;

  select count(*) filter (where p.estilo is null),
         count(*) filter (where p.estilo is not null and (p.descripcion, p.factor, p.cama, p.altura) is distinct from (i.descripcion, i.factor, i.cama, i.altura)),
         count(*) filter (where p.estilo is not null and (p.descripcion, p.factor, p.cama, p.altura) = (i.descripcion, i.factor, i.cama, i.altura))
    into v_nuevos, v_actualizados, v_sin_cambios
  from _pal i
  left join public.paletizado p on p.estilo = i.estilo;

  -- Detalle de lo que se agrega o cambia (máximo 1000 para mostrar)
  select coalesce(jsonb_agg(c order by c ->> 'tipo' desc, c ->> 'estilo'), '[]'::jsonb)
    into v_cambios
  from (
    select jsonb_build_object(
             'estilo', i.estilo,
             'tipo', case when p.estilo is null then 'nuevo' else 'actualiza' end,
             'antes', case when p.estilo is null then null
                           else jsonb_build_object('descripcion', p.descripcion, 'factor', p.factor, 'cama', p.cama, 'altura', p.altura) end,
             'despues', jsonb_build_object('descripcion', i.descripcion, 'factor', i.factor, 'cama', i.cama, 'altura', i.altura)
           ) as c
    from _pal i
    left join public.paletizado p on p.estilo = i.estilo
    where p.estilo is null
       or (p.descripcion, p.factor, p.cama, p.altura) is distinct from (i.descripcion, i.factor, i.cama, i.altura)
    order by (p.estilo is null), i.estilo
    limit 1000
  ) x;

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
    'invalidos', v_total - (select count(*) from _pal_raw),
    'repetidos', (select count(*) from _pal_raw) - (select count(*) from _pal),
    'cambios', v_cambios
  );
end $$;

revoke all on function public.guardar_paletizado(text, jsonb, boolean) from public;
grant execute on function public.guardar_paletizado(text, jsonb, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
