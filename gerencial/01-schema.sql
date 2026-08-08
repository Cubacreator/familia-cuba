-- =========================================================
-- CUBA GERENCIAL - BANCO, RLS, MFA E AUDITORIA
-- Rode este arquivo no SQL Editor do Supabase.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  passaporte text unique not null,
  nome text not null,
  cargo text not null default 'Gerencial',
  access_level text not null default 'gerencial' check (access_level in ('gerencial')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.configuracoes (
  chave text primary key,
  valor numeric not null,
  updated_at timestamptz not null default now()
);
insert into public.configuracoes(chave,valor) values ('pct_maquina',57)
on conflict(chave) do nothing;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text unique not null,
  contato text,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.membros (
  id uuid primary key default gen_random_uuid(),
  nome text unique not null,
  cargo text not null,
  passaporte text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.lavagens (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  cliente text not null,
  responsavel text not null,
  valor_sujo numeric(18,2) not null check(valor_sujo>=0),
  pct_maquina numeric(7,3) not null,
  valor_limpo numeric(18,2) not null,
  pct_cliente numeric(7,3) not null,
  valor_cliente numeric(18,2) not null,
  qtd_malas integer not null default 0,
  custo_malas numeric(18,2) not null default 0,
  qtd_alvejantes integer not null default 0,
  custo_alvejantes numeric(18,2) not null default 0,
  custo_insumos numeric(18,2) not null default 0,
  valor_cuba numeric(18,2) not null,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  categoria text not null,
  descricao text not null,
  responsavel text,
  valor numeric(18,2) not null check(valor>=0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  periodo text not null,
  membro_id uuid not null references public.membros(id) on delete restrict,
  valor_meta numeric(18,2) not null default 0,
  valor_entregue numeric(18,2) not null default 0,
  valor_pagamento numeric(18,2) not null default 0,
  data_pagamento date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.acoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  nome text not null,
  entrada numeric(18,2) not null default 0,
  custo numeric(18,2) not null default 0,
  participantes text,
  status text not null default 'Sucesso',
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  table_name text not null,
  record_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- Verifica GERÊNCIA autenticada.
create or replace function public.cuba_access_ok()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id=auth.uid()
      and p.active=true
      and p.access_level='gerencial'
  );
$$;
revoke all on function public.cuba_access_ok() from public;
grant execute on function public.cuba_access_ok() to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.configuracoes enable row level security;
alter table public.clientes enable row level security;
alter table public.membros enable row level security;
alter table public.lavagens enable row level security;
alter table public.gastos enable row level security;
alter table public.metas enable row level security;
alter table public.acoes enable row level security;
alter table public.audit_log enable row level security;

-- Remove políticas antigas com os mesmos nomes, caso rode novamente.
do $$
declare t text;
begin
  foreach t in array array['profiles','configuracoes','clientes','membros','lavagens','gastos','metas','acoes']
  loop
    execute format('drop policy if exists cuba_manager_all on public.%I',t);
    execute format('create policy cuba_manager_all on public.%I for all to authenticated using (public.cuba_access_ok()) with check (public.cuba_access_ok())',t);
  end loop;
end $$;

drop policy if exists cuba_audit_read on public.audit_log;
create policy cuba_audit_read on public.audit_log
for select to authenticated using (public.cuba_access_ok());

-- Nenhum acesso anon.
revoke all on public.profiles,public.configuracoes,public.clientes,public.membros,public.lavagens,public.gastos,public.metas,public.acoes,public.audit_log from anon;
grant select,insert,update,delete on public.profiles,public.configuracoes,public.clientes,public.membros,public.lavagens,public.gastos,public.metas,public.acoes to authenticated;
grant select on public.audit_log to authenticated;

-- Auditoria automática.
create or replace function public.audit_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare rid text;
begin
  rid=coalesce((case when tg_op='DELETE' then to_jsonb(old)->>'id' else to_jsonb(new)->>'id' end),'');
  insert into public.audit_log(user_id,table_name,record_id,action,old_data,new_data)
  values(auth.uid(),tg_table_name,rid,tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  return coalesce(new,old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['clientes','membros','lavagens','gastos','metas','acoes','configuracoes']
  loop
    execute format('drop trigger if exists trg_audit_%I on public.%I',t,t);
    execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_change()',t,t);
  end loop;
end $$;

-- Índices úteis
create index if not exists lavagens_data_idx on public.lavagens(data);
create index if not exists lavagens_cliente_idx on public.lavagens(cliente);
create index if not exists gastos_data_idx on public.gastos(data);
create index if not exists acoes_data_idx on public.acoes(data);
create index if not exists metas_membro_idx on public.metas(membro_id);

-- Membros gerenciais conhecidos (cadastro interno, sem criar login).
insert into public.membros(nome,cargo,passaporte) values
('Caroll','01','2423'),
('Caio','02','2098'),
('Renan Desbrava','Gerente Geral','3072'),
('Raissa Fernandez','Gerente Geral','7206'),
('Nickolay Meketreff','Gerente de Ação','2368')
on conflict(nome) do update set cargo=excluded.cargo,passaporte=excluded.passaporte;
