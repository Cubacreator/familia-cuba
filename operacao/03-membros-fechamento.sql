-- Cuba Management: cadastro de integrantes e controle SIMPLES de pagamento por semana.
-- Execute no SQL Editor do projeto cuba-gerencial. Não altera tabelas antigas.
-- Semana 1=1 a 7; semana 2=8 a 14; semana 3=15 a 21; semana 4=22 a 28; semana 5=29 ao último dia.
create extension if not exists pgcrypto;
create table if not exists public.cuba2_integrantes (
 id uuid primary key default gen_random_uuid(),
 nome text not null check(length(trim(nome)) between 2 and 120),
 cargo text not null default 'membro' check(cargo in ('membro','rush','elite')),
 data_entrada date not null default current_date,
 data_saida date,
 ativo boolean not null default true,
 observacoes text,
 criado_por uuid default auth.uid(),
 criado_em timestamptz not null default now(),
 check(data_saida is null or data_saida>=data_entrada)
);
create unique index if not exists cuba2_integrantes_nome_ativo_uq
 on public.cuba2_integrantes (lower(trim(nome))) where ativo=true;
create table if not exists public.cuba2_metas_semanais (
 id uuid primary key default gen_random_uuid(),
 integrante_id uuid not null references public.cuba2_integrantes(id) on delete restrict,
 ano integer not null check(ano between 2026 and 2200),
 mes integer not null check(mes between 1 and 12),
 semana integer not null check(semana between 1 and 5),
 farm_status text not null default 'pendente' check(farm_status in ('pago','pendente','isento')),
 dinheiro_status text not null default 'pendente' check(dinheiro_status in ('pago','pendente','isento')),
 observacoes text,
 atualizado_por uuid default auth.uid(),
 atualizado_em timestamptz not null default now(),
 unique(integrante_id,ano,mes,semana),
 check( (semana<5) or extract(day from (make_date(ano,mes,1)+interval '1 month - 1 day'))::integer>=29 )
);
-- Metas devem ser vinculadas ao membro que existia naquela semana.
alter table public.cuba2_integrantes enable row level security;
alter table public.cuba2_metas_semanais enable row level security;
drop policy if exists cuba2_gerencia on public.cuba2_integrantes;
create policy cuba2_gerencia on public.cuba2_integrantes for all to authenticated
 using(public.cuba_access_ok()) with check(public.cuba_access_ok());
drop policy if exists cuba2_gerencia on public.cuba2_metas_semanais;
create policy cuba2_gerencia on public.cuba2_metas_semanais for all to authenticated
 using(public.cuba_access_ok()) with check(public.cuba_access_ok());
revoke all on public.cuba2_integrantes,public.cuba2_metas_semanais from anon;
grant select,insert,update,delete on public.cuba2_integrantes,public.cuba2_metas_semanais to authenticated;
drop trigger if exists audit_cuba2 on public.cuba2_integrantes;
create trigger audit_cuba2 after insert or update or delete on public.cuba2_integrantes
 for each row execute function public.cuba2_auditar();
drop trigger if exists audit_cuba2 on public.cuba2_metas_semanais;
create trigger audit_cuba2 after insert or update or delete on public.cuba2_metas_semanais
 for each row execute function public.cuba2_auditar();
create index if not exists cuba2_metas_semanais_periodo on public.cuba2_metas_semanais(ano,mes,semana);
