-- =====================================================================
-- Painel Lisieux — Escritório virtual (camada ao vivo)
-- Migração idempotente: pode rodar mais de uma vez sem quebrar nada.
-- Tudo com prefixo "lisieux_" para conviver com outras tabelas do mesmo
-- projeto Supabase.
--
-- O que cria:
--   * public.lisieux_agent_status  — status de cada agente (work/rest)
--   * public.lisieux_secrets       — segredo de escrita (sem nenhuma policy:
--                                    só o dono do banco/funções SECURITY
--                                    DEFINER enxergam)
--   * public.lisieux_set_status()  — única porta de escrita (exige segredo)
--   * a tabela de status entra na publicação supabase_realtime
--
-- A página só LÊ (chave anon pública). Quem escreve é o script
-- scripts/agente.mjs, passando o segredo pela função.
--
-- Onde está aplicada hoje (provisório) e como mudar para um Supabase
-- próprio do Grupo Lisieux: ver supabase/LEIAME.md.
-- =====================================================================

-- ---------- Tabelas ----------
create table if not exists public.lisieux_agent_status (
  agent_id   text primary key,
  status     text not null check (status in ('work', 'rest')),
  task       text not null default '' check (char_length(task) <= 120),
  company    text,
  session    text,
  updated_at timestamptz not null default now()
);

create table if not exists public.lisieux_secrets (
  name  text primary key,
  value text not null
);

-- ---------- RLS ----------
alter table public.lisieux_agent_status enable row level security;
alter table public.lisieux_secrets      enable row level security;
-- lisieux_secrets: RLS ligado e NENHUMA policy => anon/authenticated não leem nada.

drop policy if exists lisieux_agent_status_select on public.lisieux_agent_status;
create policy lisieux_agent_status_select
  on public.lisieux_agent_status
  for select
  to anon, authenticated
  using (true);
-- Sem policies de insert/update/delete: escrita só pela função abaixo.

-- Privilégios de tabela (defesa extra além do RLS)
revoke all on table public.lisieux_secrets from anon, authenticated;
revoke insert, update, delete, truncate on table public.lisieux_agent_status from anon, authenticated;
grant select on table public.lisieux_agent_status to anon, authenticated;

-- ---------- Função de escrita ----------
create or replace function public.lisieux_set_status(
  p_secret   text,
  p_agent_id text,
  p_status   text,
  p_task     text default '',
  p_company  text default null,
  p_session  text default null
)
returns public.lisieux_agent_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
  v_task     text;
  v_row      public.lisieux_agent_status;
begin
  if p_secret is null or length(p_secret) = 0 then
    raise exception 'segredo ausente' using errcode = '28000';
  end if;

  select s.value into v_expected
    from public.lisieux_secrets s
   where s.name = 'writer';

  if v_expected is null or v_expected <> p_secret then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;

  if p_agent_id is null or p_agent_id !~ '^[a-z0-9-]{2,40}$' then
    raise exception 'agent_id inválido (use a-z, 0-9 e "-", 2 a 40 caracteres)' using errcode = '22023';
  end if;

  if p_status is null or p_status not in ('work', 'rest') then
    raise exception 'status inválido (use work ou rest)' using errcode = '22023';
  end if;

  v_task := left(btrim(coalesce(p_task, '')), 120);

  insert into public.lisieux_agent_status as a (agent_id, status, task, company, session, updated_at)
  values (
    p_agent_id,
    p_status,
    v_task,
    nullif(left(btrim(coalesce(p_company, '')), 60), ''),
    nullif(left(btrim(coalesce(p_session, '')), 120), ''),
    now()
  )
  on conflict (agent_id) do update
     set status     = excluded.status,
         task       = excluded.task,
         company    = coalesce(excluded.company, a.company),
         session    = excluded.session,
         updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.lisieux_set_status(text, text, text, text, text, text) from public;
grant execute on function public.lisieux_set_status(text, text, text, text, text, text) to anon, authenticated;

-- ---------- Realtime ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'lisieux_agent_status'
     ) then
    execute 'alter publication supabase_realtime add table public.lisieux_agent_status';
  end if;
end;
$$;

-- ---------- Etiquetas (deixam claro, dentro do próprio banco, de quem é isto) ----------
comment on table public.lisieux_agent_status is
  'GRUPO LISIEUX — Escritório virtual (vocacaodepai.github.io/grupovdp/escritorio). Status ao vivo dos agentes. PROVISÓRIO neste projeto: mudar para um projeto Supabase próprio do Grupo Lisieux (ver supabase/LEIAME.md no repo vocacaodepai/grupovdp). Não faz parte do site Vocação de Mãe.';
comment on table public.lisieux_secrets is
  'GRUPO LISIEUX — Escritório virtual. Segredo de escrita dos agentes (sem leitura pública). PROVISÓRIO neste projeto; ver supabase/LEIAME.md no repo vocacaodepai/grupovdp.';
comment on function public.lisieux_set_status(text, text, text, text, text, text) is
  'GRUPO LISIEUX — Escritório virtual. Única porta de escrita do status dos agentes (exige o segredo). PROVISÓRIO neste projeto; ver supabase/LEIAME.md no repo vocacaodepai/grupovdp.';

-- ---------- Segredo de escrita (rodar UMA vez, à mão, no SQL Editor) ----------
-- Gera um segredo aleatório dentro do banco (não aparece em lugar nenhum).
-- Para ler depois: select value from public.lisieux_secrets where name = 'writer';
-- O MESMO valor vai na variável LISIEUX_STATUS_SECRET de quem roda scripts/agente.mjs.
-- NUNCA coloque esse segredo em escritorio/config.js nem no repositório.
--
-- insert into public.lisieux_secrets (name, value)
-- values ('writer', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
-- on conflict (name) do nothing;
