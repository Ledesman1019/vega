-- =====================================================================
--  VEGA · Rótulos automáticos: se borran solos a la hora y guardan
--  de qué ingreso vienen. Paletizado ya no se puede borrar.
--
--  1) Cada rótulo automático (pendiente, impreso o anulado) se elimina
--     1 hora después de generarse, para no llenar la base. Lo impreso
--     sigue registrado en el Historial de rótulos (rotulos_historial).
--     - Cada 10 minutos con pg_cron (si el proyecto lo permite), y
--     - cada vez que la app abre los rótulos (purgar_rotulos_auto).
--  2) ingreso_num / ingreso_nota: el n.° y la nota del ingreso quedan en
--     el rótulo aunque el ingreso se elimine.
--  3) Se quita borrar_paletizado (la app ya no tiene ese botón).
--
--  Cómo usarlo:
--    Ejecuta antes 08_fv_desde_ingreso.sql. Luego pega TODO este archivo
--    en Supabase > SQL Editor > Run.
-- =====================================================================

-- 2) De qué ingreso viene cada rótulo
alter table public.rotulos_automaticos add column if not exists ingreso_num bigint;
alter table public.rotulos_automaticos add column if not exists ingreso_nota text;

update public.rotulos_automaticos r
   set ingreso_num = r.ingreso_id, ingreso_nota = i.nota
  from public.ingresos i
 where i.id = r.ingreso_id and r.ingreso_num is null;

-- El trigger del 08 ahora también copia el n.° y la nota del ingreso
create or replace function privado.tg_rotulo_fv_ingreso()
returns trigger
language plpgsql
security definer
set search_path = public, privado
as $$
declare
  v jsonb;
begin
  if new.ingreso_id is null then
    return new;
  end if;
  new.ingreso_num := new.ingreso_id;
  select nota into new.ingreso_nota from public.ingresos where id = new.ingreso_id;

  select coalesce(jsonb_agg(distinct to_char(d.fecha_vencimiento, 'YYYY-MM-DD')) filter (where d.fecha_vencimiento is not null), '[]'::jsonb)
    into v
  from public.ingresos_detalle d
  where d.ingreso_id = new.ingreso_id and d.estilo = new.estilo;

  new.fechas_ingreso := v;
  if new.fecha_vencimiento is null and jsonb_array_length(v) = 1 then
    new.fecha_vencimiento := (v ->> 0)::date;
  end if;
  return new;
end $$;
revoke all on function privado.tg_rotulo_fv_ingreso() from public, anon, authenticated;


-- 1) Borrado automático a la hora
create index if not exists rotulos_automaticos_created_idx on public.rotulos_automaticos (created_at);

-- Solo borra rótulos con más de 1 hora: es seguro que la app la llame sin clave
create or replace function public.purgar_rotulos_auto()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  delete from public.rotulos_automaticos where created_at < now() - interval '1 hour';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.purgar_rotulos_auto() from public;
grant execute on function public.purgar_rotulos_auto() to anon, authenticated;

-- Tarea cada 10 minutos (si pg_cron no está disponible, la app igual
-- limpia al abrir los rótulos y nunca muestra los de más de 1 hora)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'vega-purgar-rotulos-auto';
  perform cron.schedule('vega-purgar-rotulos-auto', '*/10 * * * *', 'select public.purgar_rotulos_auto()');
exception when others then
  raise notice 'pg_cron no disponible (%): la limpieza la hará la app.', sqlerrm;
end $$;

select public.purgar_rotulos_auto();


-- 3) El paletizado ya no se borra desde la app
drop function if exists public.borrar_paletizado(text, text);

notify pgrst, 'reload schema';
