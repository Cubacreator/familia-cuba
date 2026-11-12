-- CUBA • Operação 2026-11 (executar manualmente no Supabase SQL Editor)
-- Não altera ou apaga tabelas antigas de lavagem, ações ou caixa.
create extension if not exists pgcrypto;
create table if not exists public.cuba2_acoes (
 id uuid primary key default gen_random_uuid(),
 data date not null default current_date check(data >= date '2026-11-12'),
 nome text not null,
 modalidade text not null check(modalidade in ('fuga','tiro')),
 resultado text not null check(resultado in ('sucesso','sucesso_parcial','red')),
 participantes integer not null default 1 check(participantes >= 1),
 exitosos integer not null default 0 check(exitosos >= 0 and exitosos <= participantes),
 moeda text not null default 'real' check(moeda in ('real','dolar')),
 tipo_dinheiro text not null default 'limpo' check(tipo_dinheiro in ('limpo','sujo')),
 destino text not null default 'familia' check(destino in ('familia','integrantes','parcial','nenhum')),
 valor_total numeric(18,2) not null default 0 check(valor_total>=0),
 valor_familia numeric(18,2) not null default 0 check(valor_familia>=0),
 valor_integrantes numeric(18,2) not null default 0 check(valor_integrantes>=0),
 observacoes text,
 criado_por uuid not null default auth.uid(),
 criado_em timestamptz not null default now(),
 constraint cuba2_acao_distribuicao check(
   valor_total = valor_familia + valor_integrantes
   and ((resultado='red' and destino='nenhum' and valor_total=0 and exitosos=0)
     or (resultado<>'red' and destino<>'nenhum'
       and (destino<>'familia' or valor_integrantes=0)
       and (destino<>'integrantes' or valor_familia=0)))
 ),
 constraint cuba2_acao_sucesso check(
  (resultado='red' and exitosos=0)
  or (resultado='sucesso' and exitosos=participantes)
  or (resultado='sucesso_parcial' and exitosos>0 and exitosos<participantes)
 )
);
create table if not exists public.cuba2_produtos(
 id uuid primary key default gen_random_uuid(), nome text not null unique,
 categoria text not null default 'Produto RP', preco_padrao numeric(18,2) not null default 0 check(preco_padrao>=0),
 ativo boolean not null default true, criado_em timestamptz not null default now()
);
create table if not exists public.cuba2_vendas(
 id uuid primary key default gen_random_uuid(),
 data date not null default current_date check(data >= date '2026-11-12'),
 produto_id uuid not null references public.cuba2_produtos(id),
 quantidade integer not null check(quantidade>0),
 preco_unitario numeric(18,2) not null check(preco_unitario>=0),
 desconto numeric(18,2) not null default 0 check(desconto>=0),
 recebido numeric(18,2) not null default 0 check(recebido>=0),
 status text not null default 'concluida' check(status in ('concluida','cancelada')),
 observacoes text, criado_por uuid not null default auth.uid(), criado_em timestamptz not null default now(),
 constraint cuba2_vendas_valor check (desconto<=quantidade*preco_unitario and recebido<=quantidade*preco_unitario-desconto)
);
create table if not exists public.cuba2_caixa(
 id uuid primary key default gen_random_uuid(),
 data date not null default current_date check(data >= date '2026-11-12'),
 categoria text not null check(categoria in ('entrada','saida','saldo_inicial')),
 descricao text not null,
 valor numeric(18,2) not null check(valor>=0),
 moeda text not null default 'real' check(moeda in ('real','dolar')),
 referencia_acao uuid references public.cuba2_acoes(id),
 referencia_venda uuid references public.cuba2_vendas(id),
 criado_por uuid not null default auth.uid(), criado_em timestamptz not null default now()
);
-- O caixa usa lançamentos explícitos; relatório de ações não soma outra vez.
-- Uma ação com receita para a família NÃO entra automaticamente no caixa: exige confirmação de recebimento.
create table if not exists public.cuba2_auditoria(
 id bigint generated always as identity primary key,
 tabela text not null, registro text, operacao text not null,
 ator uuid, antes jsonb, depois jsonb, criado_em timestamptz not null default now()
);
create or replace function public.cuba2_auditar() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.cuba2_auditoria(tabela,registro,operacao,ator,antes,depois)
 values(tg_table_name,coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',''),tg_op,auth.uid(),
 case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
 case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
do $$ declare t text; begin
 foreach t in array array['cuba2_acoes','cuba2_produtos','cuba2_vendas','cuba2_caixa'] loop
  execute format('drop trigger if exists audit_cuba2 on public.%I',t);
  execute format('create trigger audit_cuba2 after insert or update or delete on public.%I for each row execute function public.cuba2_auditar()',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists cuba2_gerencia on public.%I',t);
  execute format('create policy cuba2_gerencia on public.%I for all to authenticated using (public.cuba_access_ok()) with check (public.cuba_access_ok())',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
alter table public.cuba2_auditoria enable row level security;
drop policy if exists cuba2_audit_read on public.cuba2_auditoria;
create policy cuba2_audit_read on public.cuba2_auditoria for select to authenticated using(public.cuba_access_ok());
revoke all on public.cuba2_auditoria from anon;
grant select on public.cuba2_auditoria to authenticated;
create index if not exists cuba2_acoes_data on public.cuba2_acoes(data);
create index if not exists cuba2_vendas_data on public.cuba2_vendas(data);
create index if not exists cuba2_caixa_data on public.cuba2_caixa(data);
-- Crie os 6 usuários com passaportes reais (NÃO inventar dados). Cadastre os perfis com auth.users
-- Carol 01; Caio 02; Felipe Gerente de Farm; Renan e Raissa Gerentes Gerais; Jamal Gerente de Ação
-- Todos: access_level='gerencial', active=true. Nenhum membro comum recebe autenticação.
