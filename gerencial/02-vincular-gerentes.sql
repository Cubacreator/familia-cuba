-- =========================================================
-- CUBA - VINCULAR OS 5 LOGINS GERENCIAIS
-- IMPORTANTE:
-- 1) Primeiro crie manualmente os usuários no Supabase:
--    Authentication > Users > Add user
-- 2) Use os emails internos abaixo e defina uma senha forte diferente para cada pessoa.
-- 3) Marque/considere o usuário confirmado ao criá-lo pelo Dashboard.
-- 4) Só depois rode este arquivo.
-- =========================================================

insert into public.profiles(user_id,passaporte,nome,cargo,access_level,active)
select id,'2423','Caroll','01','gerencial',true from auth.users where email='2423@cuba.local'
on conflict(passaporte) do update set user_id=excluded.user_id,nome=excluded.nome,cargo=excluded.cargo,active=true;

insert into public.profiles(user_id,passaporte,nome,cargo,access_level,active)
select id,'2098','Caio','02','gerencial',true from auth.users where email='2098@cuba.local'
on conflict(passaporte) do update set user_id=excluded.user_id,nome=excluded.nome,cargo=excluded.cargo,active=true;

insert into public.profiles(user_id,passaporte,nome,cargo,access_level,active)
select id,'3072','Renan Desbrava','Gerente Geral','gerencial',true from auth.users where email='3072@cuba.local'
on conflict(passaporte) do update set user_id=excluded.user_id,nome=excluded.nome,cargo=excluded.cargo,active=true;

insert into public.profiles(user_id,passaporte,nome,cargo,access_level,active)
select id,'7206','Raissa Fernandez','Gerente Geral','gerencial',true from auth.users where email='7206@cuba.local'
on conflict(passaporte) do update set user_id=excluded.user_id,nome=excluded.nome,cargo=excluded.cargo,active=true;

insert into public.profiles(user_id,passaporte,nome,cargo,access_level,active)
select id,'2368','Nickolay Meketreff','Gerente de Ação','gerencial',true from auth.users where email='2368@cuba.local'
on conflict(passaporte) do update set user_id=excluded.user_id,nome=excluded.nome,cargo=excluded.cargo,active=true;
