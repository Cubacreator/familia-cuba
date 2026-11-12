-- CUBA: Metas por cargo • Migração 02 • executar uma única vez no SQL Editor.
-- Não altera nenhuma tabela antiga.
create table if not exists public.cuba2_metas (
 id uuid primary key default gen_random_uuid(),
 data date not null check(data >= date '2026-11-12'),
 membro text not null check(length(trim(membro)) > 0),
 grupo text not null check(grupo in ('rush','elite')),
 opcao_rush text check(opcao_rush in ('4_bunkers','2_bunkers_2_lixos','4_lixos')),
 bunkers integer not null default 0 check(bunkers>=0),
 lixos integer not null default 0 check(lixos>=0),
 valor_entregue numeric(18,2) not null default 0 check(valor_entregue>=0),
 acoes_familia integer not null default 0 check(acoes_familia>=0),
 acoes_integrantes integer not null default 0 check(acoes_integrantes>=0),
 observacoes text,
 criado_por uuid default auth.uid(),
 criado_em timestamptz not null default now(),
 constraint cuba2_metas_opcao check ((grupo='rush' and opcao_rush is not null) or (grupo='elite' and opcao_rush is null))
);
alter table public.cuba2_metas enable row level security;
drop policy if exists cuba2_gerencia on public.cuba2_metas;
create policy cuba2_gerencia on public.cuba2_metas for all to authenticated
 using(public.cuba_access_ok()) with check(public.cuba_access_ok());
revoke all on public.cuba2_metas from anon;
grant select,insert,update,delete on public.cuba2_metas to authenticated;
drop trigger if exists audit_cuba2 on public.cuba2_metas;
create trigger audit_cuba2 after insert or update or delete on public.cuba2_metas
 for each row execute function public.cuba2_auditar();
create index if not exists cuba2_metas_data_membro on public.cuba2_metas(data,membro);
