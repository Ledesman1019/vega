-- =====================================================================
--  VEGA · La fecha de vencimiento del rótulo automático sale del ingreso
--
--  Al generarse un rótulo se buscan las fechas de vencimiento que trae
--  ese producto en el Excel del ingreso (ingresos_detalle):
--    - UNA sola fecha   -> se pone en el rótulo (se puede cambiar)
--    - VARIAS fechas    -> no se adivina: el rótulo queda sin fecha y la
--                          app muestra las fechas del ingreso para elegir
--  Las fechas del ingreso quedan guardadas en el rótulo (fechas_ingreso),
--  aunque después se elimine el ingreso.
--
--  También completa los rótulos PENDIENTES que ya existen.
--
--  Cómo usarlo:
--    Ejecuta antes 07_ingresos_detalle.sql. Luego pega TODO este archivo
--    en Supabase > SQL Editor > Run.
-- =====================================================================

alter table public.rotulos_automaticos
  add column if not exists fechas_ingreso jsonb not null default '[]'::jsonb;

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

drop trigger if exists rotulos_automaticos_fv_ingreso on public.rotulos_automaticos;
create trigger rotulos_automaticos_fv_ingreso
  before insert on public.rotulos_automaticos
  for each row execute function privado.tg_rotulo_fv_ingreso();

-- Completa los rótulos pendientes que ya existen
update public.rotulos_automaticos r
   set fechas_ingreso = x.fechas,
       fecha_vencimiento = case
                             when r.fecha_vencimiento is null and jsonb_array_length(x.fechas) = 1 then (x.fechas ->> 0)::date
                             else r.fecha_vencimiento
                           end
  from (
    select ingreso_id, estilo, jsonb_agg(distinct to_char(fecha_vencimiento, 'YYYY-MM-DD')) as fechas
    from public.ingresos_detalle
    where fecha_vencimiento is not null
    group by ingreso_id, estilo
  ) x
 where r.ingreso_id = x.ingreso_id
   and r.estilo = x.estilo
   and r.estado = 'pendiente';

notify pgrst, 'reload schema';
