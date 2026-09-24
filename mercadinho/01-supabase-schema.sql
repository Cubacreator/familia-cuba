-- CUBA — primeira instalação do Mercadinho
-- Execute no SQL Editor do projeto Supabase usado pelo site.
-- Usa os gerentes já cadastrados em public.profiles e public.cuba_access_ok().
-- Não cria contas de teste com senha pública: a gerência as cria na tela Acessos.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mercado_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  estoque integer not null default 0 check (estoque >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.mercado_acessos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  passaporte text not null unique,
  senha_hash text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.mercado_sessoes (
  id uuid primary key default gen_random_uuid(),
  acesso_id uuid not null references public.mercado_acessos(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.mercado_movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.mercado_itens(id) on delete restrict,
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade integer not null check (quantidade > 0),
  estoque_anterior integer not null check (estoque_anterior >= 0),
  estoque_posterior integer not null check (estoque_posterior >= 0),
  responsavel_nome text not null,
  responsavel_tipo text not null check (responsavel_tipo in ('gerencia','membro')),
  responsavel_auth_id uuid references auth.users(id) on delete set null,
  responsavel_acesso_id uuid references public.mercado_acessos(id) on delete set null,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists mercado_movimentos_data_idx on public.mercado_movimentos(created_at desc);
create index if not exists mercado_movimentos_item_idx on public.mercado_movimentos(item_id, created_at desc);
create index if not exists mercado_sessoes_expira_idx on public.mercado_sessoes(expires_at);

-- Catálogo inicial com os 24 itens já fotografados no site. O saldo fica em 0
-- para a gerência cadastrar os números reais depois da instalação.
insert into public.mercado_itens(nome, descricao, estoque) values
  ('Tablet Infinito', null, 0), ('C4', null, 0), ('Bandagem', null, 0),
  ('Corda', null, 0), ('Hack', null, 0), ('Álcool em Gel', null, 0),
  ('Pílula', null, 0), ('Alicate', null, 0), ('Capuz', null, 0),
  ('Controlador', null, 0), ('Munição de Tec9', null, 0), ('Tec9', null, 0),
  ('Abraçadeira', null, 0), ('Micro SMG', null, 0), ('FN Five-seveN', null, 0),
  ('Munição de MP7', null, 0), ('Munição de Pistola HK', null, 0),
  ('Pistola HK', null, 0), ('Broca', null, 0), ('Furadeira', null, 0),
  ('Óculos de visão noturna', null, 0), ('Pager', null, 0),
  ('Roupa de mergulho', null, 0), ('Munição de FN Five-seveN', null, 0)
on conflict (nome) do nothing;

alter table public.mercado_itens enable row level security;
alter table public.mercado_acessos enable row level security;
alter table public.mercado_sessoes enable row level security;
alter table public.mercado_movimentos enable row level security;

-- O navegador não lê nem altera tabelas diretamente. Todas as operações passam
-- por RPCs SECURITY DEFINER que validam a sessão de membro ou de gerência.
revoke all on public.mercado_itens, public.mercado_acessos, public.mercado_sessoes, public.mercado_movimentos from anon, authenticated;

create or replace function public._mercado_exigir_gerencia()
returns void language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.cuba_access_ok(), false) then
    raise exception 'Acesso restrito à gerência.' using errcode = '42501';
  end if;
end $$;

create or replace function public._mercado_sessao_membro(p_token text)
returns table(acesso_id uuid, nome text)
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
begin
  if nullif(p_token, '') is null then return; end if;
  return query
    select a.id, a.nome
    from public.mercado_sessoes s
    join public.mercado_acessos a on a.id = s.acesso_id
    where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
      and s.expires_at > now() and a.ativo;
  update public.mercado_sessoes s set last_seen_at = now()
    where s.token_hash = encode(digest(p_token, 'sha256'), 'hex') and s.expires_at > now();
end $$;

revoke all on function public._mercado_exigir_gerencia() from public, anon, authenticated;
revoke all on function public._mercado_sessao_membro(text) from public, anon, authenticated;

create or replace function public.mercado_admin_contexto()
returns table(nome text, cargo text)
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
begin
  perform public._mercado_exigir_gerencia();
  return query select p.nome, p.cargo from public.profiles p where p.user_id = auth.uid() and p.active;
end $$;

create or replace function public.mercado_login(p_passaporte text, p_senha text)
returns table(token text, nome text)
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare v_id uuid; v_nome text; v_token text;
begin
  select a.id, a.nome into v_id, v_nome
  from public.mercado_acessos a
  where a.passaporte = trim(p_passaporte) and a.ativo
    and a.senha_hash = crypt(p_senha, a.senha_hash);
  if v_id is null then raise exception 'Acesso inválido.' using errcode = '28000'; end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.mercado_sessoes(acesso_id, token_hash, expires_at)
  values(v_id, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '30 days');
  return query select v_token, v_nome;
end $$;

create or replace function public.mercado_validar_sessao(p_token text)
returns table(nome text)
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare v record;
begin
  select * into v from public._mercado_sessao_membro(p_token);
  if v.acesso_id is not null then return query select v.nome; end if;
end $$;

create or replace function public.mercado_logout(p_token text)
returns boolean language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
begin
  delete from public.mercado_sessoes where token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex');
  return true;
end $$;

create or replace function public.mercado_listar_itens(p_token text default null)
returns table(id uuid, nome text, descricao text, estoque integer, disponivel boolean)
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare v record;
begin
  if auth.uid() is not null and coalesce(public.cuba_access_ok(), false) then null;
  else
    select * into v from public._mercado_sessao_membro(p_token);
    if v.acesso_id is null then raise exception 'Sessão inválida.' using errcode = '28000'; end if;
  end if;
  return query select i.id, i.nome, i.descricao, i.estoque, (i.estoque > 0)
    from public.mercado_itens i where i.ativo order by i.nome;
end $$;

create or replace function public.mercado_minhas_retiradas(p_token text)
returns table(created_at timestamptz, item_nome text, quantidade integer)
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare v record;
begin
  select * into v from public._mercado_sessao_membro(p_token);
  if v.acesso_id is null then raise exception 'Sessão inválida.' using errcode = '28000'; end if;
  return query select m.created_at, i.nome, m.quantidade
    from public.mercado_movimentos m join public.mercado_itens i on i.id=m.item_id
    where m.responsavel_acesso_id=v.acesso_id and m.tipo='saida'
    order by m.created_at desc limit 200;
end $$;

create or replace function public.mercado_admin_listar_itens()
returns table(id uuid, nome text, descricao text, estoque integer, ativo boolean)
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
begin
  perform public._mercado_exigir_gerencia();
  return query select i.id,i.nome,i.descricao,i.estoque,i.ativo from public.mercado_itens i where i.ativo order by i.nome;
end $$;

create or replace function public.mercado_admin_listar_movimentos(p_limite integer default 200)
returns table(id uuid, created_at timestamptz, item_nome text, tipo text, quantidade integer, responsavel_nome text, estoque_anterior integer, estoque_posterior integer, observacao text)
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
begin
  perform public._mercado_exigir_gerencia();
  return query select m.id,m.created_at,i.nome,m.tipo,m.quantidade,m.responsavel_nome,m.estoque_anterior,m.estoque_posterior,m.observacao
    from public.mercado_movimentos m join public.mercado_itens i on i.id=m.item_id
    order by m.created_at desc limit greatest(1,least(coalesce(p_limite,200),1000));
end $$;

create or replace function public.mercado_listar_acessos()
returns table(id uuid, nome text, passaporte text, created_at timestamptz)
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
begin
  perform public._mercado_exigir_gerencia();
  return query select a.id,a.nome,a.passaporte,a.created_at from public.mercado_acessos a where a.ativo order by a.nome;
end $$;

create or replace function public.mercado_admin_listar_membros()
returns table(nome text, passaporte text)
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
begin
  perform public._mercado_exigir_gerencia();
  return query select m.nome,m.passaporte from public.membros m order by m.nome;
end $$;

create or replace function public.mercado_criar_acesso(p_nome text, p_passaporte text, p_senha text)
returns uuid language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare v_id uuid;
begin
  perform public._mercado_exigir_gerencia();
  if length(trim(coalesce(p_nome,'')))=0 or length(trim(coalesce(p_passaporte,'')))=0 then raise exception 'Informe nome e passaporte.'; end if;
  if length(coalesce(p_senha,'')) < 6 then raise exception 'A senha deve ter ao menos 6 caracteres.'; end if;
  insert into public.mercado_acessos(nome,passaporte,senha_hash,created_by)
  values(trim(p_nome),trim(p_passaporte),crypt(p_senha,gen_salt('bf')),auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.mercado_excluir_acesso(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
begin
  perform public._mercado_exigir_gerencia();
  update public.mercado_acessos set ativo=false where id=p_id;
  delete from public.mercado_sessoes where acesso_id=p_id;
  return found;
end $$;

create or replace function public.mercado_admin_criar_item(p_nome text, p_descricao text, p_estoque_inicial integer)
returns uuid language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare v_id uuid; v_q integer:=greatest(0,coalesce(p_estoque_inicial,0)); v_nome text;
begin
  perform public._mercado_exigir_gerencia();
  v_nome:=trim(coalesce(p_nome,'')); if v_nome='' then raise exception 'Informe o nome do item.'; end if;
  insert into public.mercado_itens(nome,descricao,estoque,created_by) values(v_nome,nullif(trim(p_descricao),''),v_q,auth.uid()) returning id into v_id;
  if v_q>0 then insert into public.mercado_movimentos(item_id,tipo,quantidade,estoque_anterior,estoque_posterior,responsavel_nome,responsavel_tipo,responsavel_auth_id,observacao)
    select v_id,'entrada',v_q,0,v_q,p.nome,'gerencia',auth.uid(),'Estoque inicial do item' from public.profiles p where p.user_id=auth.uid(); end if;
  return v_id;
end $$;

create or replace function public.mercado_admin_entrada(p_item_id uuid, p_quantidade integer, p_observacao text default null)
returns integer language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare v_before integer; v_after integer; v_nome text;
begin
  perform public._mercado_exigir_gerencia();
  if coalesce(p_quantidade,0)<=0 then raise exception 'A quantidade deve ser maior que zero.'; end if;
  select estoque into v_before from public.mercado_itens where id=p_item_id and ativo for update;
  if not found then raise exception 'Item não encontrado.'; end if;
  v_after:=v_before+p_quantidade;
  update public.mercado_itens set estoque=v_after where id=p_item_id;
  select nome into v_nome from public.profiles where user_id=auth.uid();
  insert into public.mercado_movimentos(item_id,tipo,quantidade,estoque_anterior,estoque_posterior,responsavel_nome,responsavel_tipo,responsavel_auth_id,observacao)
  values(p_item_id,'entrada',p_quantidade,v_before,v_after,coalesce(v_nome,'Gerência'),'gerencia',auth.uid(),nullif(trim(p_observacao),''));
  return v_after;
end $$;

create or replace function public.mercado_membro_entrada(p_token text, p_item_id uuid, p_quantidade integer, p_observacao text default null)
returns integer language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare v_member record; v_before integer; v_after integer;
begin
  select * into v_member from public._mercado_sessao_membro(p_token);
  if v_member.acesso_id is null then raise exception 'Sessão inválida.' using errcode = '28000'; end if;
  if coalesce(p_quantidade,0)<=0 then raise exception 'A quantidade deve ser maior que zero.'; end if;
  select estoque into v_before from public.mercado_itens where id=p_item_id and ativo for update;
  if not found then raise exception 'Item não encontrado.'; end if;
  v_after:=v_before+p_quantidade;
  update public.mercado_itens set estoque=v_after where id=p_item_id;
  insert into public.mercado_movimentos(item_id,tipo,quantidade,estoque_anterior,estoque_posterior,responsavel_nome,responsavel_tipo,responsavel_acesso_id,observacao)
  values(p_item_id,'entrada',p_quantidade,v_before,v_after,v_member.nome,'membro',v_member.acesso_id,nullif(trim(p_observacao),''));
  return v_after;
end $$;

create or replace function public.mercado_retirar_item(p_token text, p_item_id uuid, p_quantidade integer)
returns integer language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare v_member record; v_before integer; v_after integer; v_nome text; v_tipo text; v_auth uuid; v_acesso uuid;
begin
  if auth.uid() is not null and coalesce(public.cuba_access_ok(),false) then
    select nome into v_nome from public.profiles where user_id=auth.uid(); v_tipo:='gerencia'; v_auth:=auth.uid();
  else
    select * into v_member from public._mercado_sessao_membro(p_token);
    if v_member.acesso_id is null then raise exception 'Sessão inválida.' using errcode = '28000'; end if;
    v_nome:=v_member.nome; v_tipo:='membro'; v_acesso:=v_member.acesso_id;
  end if;
  if coalesce(p_quantidade,0)<=0 then raise exception 'A quantidade deve ser maior que zero.'; end if;
  select estoque into v_before from public.mercado_itens where id=p_item_id and ativo for update;
  if not found then raise exception 'Item não encontrado.'; end if;
  if v_before<p_quantidade then raise exception 'Estoque insuficiente. Disponível: %',v_before; end if;
  v_after:=v_before-p_quantidade;
  update public.mercado_itens set estoque=v_after where id=p_item_id;
  insert into public.mercado_movimentos(item_id,tipo,quantidade,estoque_anterior,estoque_posterior,responsavel_nome,responsavel_tipo,responsavel_auth_id,responsavel_acesso_id)
  values(p_item_id,'saida',p_quantidade,v_before,v_after,v_nome,v_tipo,v_auth,v_acesso);
  return v_after;
end $$;

create or replace function public.mercado_admin_ajustar(p_item_id uuid, p_novo_estoque integer, p_observacao text default null)
returns integer language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare v_before integer; v_q integer; v_nome text;
begin
  perform public._mercado_exigir_gerencia();
  if coalesce(p_novo_estoque,-1)<0 then raise exception 'O estoque não pode ser negativo.'; end if;
  select estoque into v_before from public.mercado_itens where id=p_item_id and ativo for update;
  if not found then raise exception 'Item não encontrado.'; end if;
  if v_before=p_novo_estoque then return v_before; end if;
  v_q:=abs(p_novo_estoque-v_before);
  update public.mercado_itens set estoque=p_novo_estoque where id=p_item_id;
  select nome into v_nome from public.profiles where user_id=auth.uid();
  insert into public.mercado_movimentos(item_id,tipo,quantidade,estoque_anterior,estoque_posterior,responsavel_nome,responsavel_tipo,responsavel_auth_id,observacao)
  values(p_item_id,'ajuste',v_q,v_before,p_novo_estoque,coalesce(v_nome,'Gerência'),'gerencia',auth.uid(),nullif(trim(p_observacao),''));
  return p_novo_estoque;
end $$;

create or replace function public.mercado_admin_desativar_item(p_item_id uuid)
returns boolean language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
begin
  perform public._mercado_exigir_gerencia();
  update public.mercado_itens set ativo=false where id=p_item_id;
  return found;
end $$;

-- As funções públicas recebem apenas as credenciais de sessão de membro; as
-- funções administrativas validam profiles/cuba_access_ok() no banco.
revoke all on function public._mercado_exigir_gerencia() from public, anon, authenticated;
revoke all on function public._mercado_sessao_membro(text) from public, anon, authenticated;
revoke all on function public.mercado_admin_contexto() from public, anon, authenticated;
revoke all on function public.mercado_login(text,text) from public, anon, authenticated;
revoke all on function public.mercado_validar_sessao(text) from public, anon, authenticated;
revoke all on function public.mercado_logout(text) from public, anon, authenticated;
revoke all on function public.mercado_listar_itens(text) from public, anon, authenticated;
revoke all on function public.mercado_minhas_retiradas(text) from public, anon, authenticated;
revoke all on function public.mercado_admin_listar_itens() from public, anon, authenticated;
revoke all on function public.mercado_admin_listar_movimentos(integer) from public, anon, authenticated;
revoke all on function public.mercado_listar_acessos() from public, anon, authenticated;
revoke all on function public.mercado_admin_listar_membros() from public, anon, authenticated;
revoke all on function public.mercado_criar_acesso(text,text,text) from public, anon, authenticated;
revoke all on function public.mercado_excluir_acesso(uuid) from public, anon, authenticated;
revoke all on function public.mercado_admin_criar_item(text,text,integer) from public, anon, authenticated;
revoke all on function public.mercado_admin_entrada(uuid,integer,text) from public, anon, authenticated;
revoke all on function public.mercado_membro_entrada(text,uuid,integer,text) from public, anon, authenticated;
revoke all on function public.mercado_retirar_item(text,uuid,integer) from public, anon, authenticated;
revoke all on function public.mercado_admin_ajustar(uuid,integer,text) from public, anon, authenticated;
revoke all on function public.mercado_admin_desativar_item(uuid) from public, anon, authenticated;

grant execute on function public.mercado_login(text,text) to anon, authenticated;
grant execute on function public.mercado_validar_sessao(text) to anon, authenticated;
grant execute on function public.mercado_logout(text) to anon, authenticated;
grant execute on function public.mercado_listar_itens(text) to anon, authenticated;
grant execute on function public.mercado_minhas_retiradas(text) to anon, authenticated;
grant execute on function public.mercado_membro_entrada(text,uuid,integer,text) to anon, authenticated;
grant execute on function public.mercado_retirar_item(text,uuid,integer) to anon, authenticated;
grant execute on function public.mercado_admin_contexto() to authenticated;
grant execute on function public.mercado_admin_listar_itens() to authenticated;
grant execute on function public.mercado_admin_listar_movimentos(integer) to authenticated;
grant execute on function public.mercado_listar_acessos() to authenticated;
grant execute on function public.mercado_admin_listar_membros() to authenticated;
grant execute on function public.mercado_criar_acesso(text,text,text) to authenticated;
grant execute on function public.mercado_excluir_acesso(uuid) to authenticated;
grant execute on function public.mercado_admin_criar_item(text,text,integer) to authenticated;
grant execute on function public.mercado_admin_entrada(uuid,integer,text) to authenticated;
grant execute on function public.mercado_admin_ajustar(uuid,integer,text) to authenticated;
grant execute on function public.mercado_admin_desativar_item(uuid) to authenticated;

-- Recarrega o cache do PostgREST para reconhecer as novas funções imediatamente.
notify pgrst, 'reload schema';

select 'Mercadinho pronto' as status, count(*) as itens_no_catalogo
from public.mercado_itens where ativo;
