-- =====================================================================
--  VEGA · Sistema de rótulos — Esquema de base de datos (Supabase)
--
--  Cómo usarlo:
--    Supabase > SQL Editor > New query > pega TODO este archivo > Run.
--    Se puede ejecutar más de una vez sin romper nada (es idempotente).
-- =====================================================================

create extension if not exists pg_trgm;


-- ---------------------------------------------------------------------
-- 1) PRODUCTOS (la base que se importa/exporta en Excel)
-- ---------------------------------------------------------------------
create table if not exists public.productos (
  estilo       text primary key,
  descripcion  text not null,
  -- Marca = primera palabra de la descripción (se calcula sola)
  marca        text generated always as (upper(split_part(btrim(descripcion), ' ', 1))) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint productos_estilo_valido check (estilo ~ '^[0-9A-Za-z-]{1,20}$'),
  constraint productos_descripcion_valida check (length(btrim(descripcion)) > 0)
);

create index if not exists productos_marca_idx on public.productos (marca);
create index if not exists productos_descripcion_trgm_idx
  on public.productos using gin (descripcion gin_trgm_ops);
create index if not exists productos_estilo_trgm_idx
  on public.productos using gin (estilo gin_trgm_ops);

-- updated_at automático
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists productos_set_updated_at on public.productos;
create trigger productos_set_updated_at
  before update on public.productos
  for each row execute function public.tg_set_updated_at();

-- Lista de marcas con su cantidad de productos (para el filtro)
create or replace view public.productos_marcas
with (security_invoker = true) as
  select marca, count(*)::int as total
  from public.productos
  group by marca
  order by marca;

-- Vaciar toda la base de productos (botón "Vaciar base").
-- Es la ÚNICA forma de borrar productos desde la app: no se permite
-- eliminar productos uno por uno.
create or replace function public.vaciar_productos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table public.productos;
end $$;


-- ---------------------------------------------------------------------
-- 2) HISTORIAL DE RÓTULOS (cada impresión o descarga queda registrada)
-- ---------------------------------------------------------------------
create table if not exists public.rotulos_historial (
  id                 bigint generated always as identity primary key,
  estilo             text not null,
  descripcion        text not null,
  fecha_vencimiento  date not null,
  cantidad           integer not null check (cantidad > 0),
  accion             text not null check (accion in ('impreso', 'descargado')),
  papel              text not null default 'A4' check (papel in ('A4', 'Carta')),
  created_at         timestamptz not null default now()
);

create index if not exists rotulos_historial_created_idx on public.rotulos_historial (created_at desc);
create index if not exists rotulos_historial_estilo_idx  on public.rotulos_historial (estilo);


-- ---------------------------------------------------------------------
-- 3) SEGURIDAD (RLS)
--    La app no tiene inicio de sesión, así que trabaja con la clave
--    "anon". Permisos:
--      productos          -> ver, agregar, importar (insert/update)
--                            NO borrar filas sueltas (solo "vaciar base")
--      rotulos_historial  -> ver y registrar. NO editar ni borrar.
-- ---------------------------------------------------------------------
alter table public.productos         enable row level security;
alter table public.rotulos_historial enable row level security;

drop policy if exists "productos_select" on public.productos;
drop policy if exists "productos_insert" on public.productos;
drop policy if exists "productos_update" on public.productos;
create policy "productos_select" on public.productos for select to anon, authenticated using (true);
create policy "productos_insert" on public.productos for insert to anon, authenticated with check (true);
create policy "productos_update" on public.productos for update to anon, authenticated using (true) with check (true);

drop policy if exists "historial_select" on public.rotulos_historial;
drop policy if exists "historial_insert" on public.rotulos_historial;
create policy "historial_select" on public.rotulos_historial for select to anon, authenticated using (true);
create policy "historial_insert" on public.rotulos_historial for insert to anon, authenticated with check (true);

-- Permisos explícitos (algunos proyectos nuevos de Supabase ya no los dan por defecto)
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.productos to anon, authenticated;
revoke delete on public.productos from anon, authenticated;
grant select on public.productos_marcas to anon, authenticated;
grant select, insert on public.rotulos_historial to anon, authenticated;
revoke update, delete on public.rotulos_historial from anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
revoke all on function public.vaciar_productos() from public;
grant execute on function public.vaciar_productos() to anon, authenticated;

-- Que la API (PostgREST) vea los cambios al instante
notify pgrst, 'reload schema';
