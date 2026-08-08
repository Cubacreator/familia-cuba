-- CUBA V10.2 - CORREÇÃO DA AUDITORIA
-- Rode no SQL Editor do Supabase.

-- Cria vínculo entre audit_log.user_id e profiles.user_id, caso ainda não exista.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_log_user_id_fkey'
      and conrelid = 'public.audit_log'::regclass
  ) then
    alter table public.audit_log
      add constraint audit_log_user_id_fkey
      foreign key (user_id)
      references public.profiles(user_id)
      on delete set null;
  end if;
end $$;

-- Confirma que a auditoria já possui eventos.
select id, user_id, table_name, record_id, action, created_at
from public.audit_log
order by created_at desc
limit 20;
