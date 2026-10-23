# Escritório virtual do Grupo Lisieux: onde está o banco

O escritório ao vivo (`escritorio/`) guarda o status dos agentes num banco
Supabase. **Por enquanto ele mora, de forma provisória, num projeto que já
existia.** Quando o Grupo Lisieux tiver uma conta Supabase própria, é só
seguir a seção "Como mudar" lá embaixo.

## Onde está hoje

| O quê | Valor |
|---|---|
| Organização Supabase | **Grupo V.D.P.** |
| Projeto | **Vocação de Mãe** |
| ID do projeto | `apizwpstssjhiccrhwxu` |
| URL | `https://apizwpstssjhiccrhwxu.supabase.co` |
| Criado em | 23/10/2026 |

Objetos criados nesse projeto (todos com prefixo `lisieux_` e com um
comentário "GRUPO LISIEUX — ... PROVISÓRIO" dentro do próprio banco):

| Objeto | Para quê |
|---|---|
| tabela `public.lisieux_agent_status` | status de cada agente (`work`/`rest`), tarefa, empresa, horário. Leitura pública, escrita só pela função. |
| tabela `public.lisieux_secrets` | guarda o segredo de escrita (`name = 'writer'`). Ninguém de fora lê. |
| função `public.lisieux_set_status(...)` | única porta de escrita; recusa sem o segredo certo. |
| publicação `supabase_realtime` | a tabela de status foi adicionada, para a página receber as mudanças na hora. |

Nada disso mexe nas tabelas, nas páginas ou no SEO do site Vocação de Mãe:
são tabelas separadas, que o site não lê.

### Avisos esperados no "Security Advisor" do Supabase

- `lisieux_set_status` aparece como "SECURITY DEFINER executável por anon".
  **É de propósito**: é a porta de escrita dos agentes, e ela só grava com o
  segredo certo.
- `lisieux_secrets` aparece como "RLS ligado sem policy". **Também é de
  propósito**: sem policy, ninguém de fora lê o segredo.

## Quem usa o quê

- **Página do escritório** (`escritorio/config.js`): URL + chave
  *publicável* (pública por design; só lê).
- **Agentes e rotinas** (`scripts/agente.mjs`): precisam só da variável
  `LISIEUX_STATUS_SECRET`. A URL e a chave pública vêm do `config.js`.

### Onde ver o segredo de escrita

O segredo foi gerado aleatoriamente dentro do banco e **não está no
repositório**. Para ver (quando for configurar uma rotina), no painel do
Supabase → projeto Vocação de Mãe → SQL Editor:

```sql
select value from public.lisieux_secrets where name = 'writer';
```

Copie o valor para a variável `LISIEUX_STATUS_SECRET` do ambiente onde a
rotina roda. Nunca cole esse valor em `escritorio/config.js`, em commits ou
em mensagens.

Para trocar o segredo (se vazar):

```sql
update public.lisieux_secrets
   set value = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 where name = 'writer';
```

Depois atualize `LISIEUX_STATUS_SECRET` onde ele estiver configurado.

## Como mudar para um Supabase próprio do Grupo Lisieux

1. **Criar o projeto novo** (ex.: organização "Grupo Lisieux", projeto
   "Escritório Lisieux"). O plano gratuito serve.
2. **Rodar a migração**: abrir o SQL Editor do projeto novo, colar todo o
   conteúdo de `supabase/escritorio.sql` e executar. Ela pode rodar mais de
   uma vez sem problema.
3. **Gerar o segredo** no projeto novo:
   ```sql
   insert into public.lisieux_secrets (name, value)
   values ('writer', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
   on conflict (name) do nothing;
   ```
4. **Apontar a página**: em `escritorio/config.js`, trocar `supabaseUrl` e
   `supabaseAnonKey` pela URL e pela chave publicável do projeto novo
   (Settings → API Keys). Commit e push.
5. **Apontar as rotinas**: trocar o valor de `LISIEUX_STATUS_SECRET` no
   ambiente das rotinas pelo segredo novo (e, se alguma rotina tiver
   `LISIEUX_SUPABASE_URL`/`LISIEUX_SUPABASE_ANON_KEY` próprios, trocar também).
6. **Conferir**: `node scripts/agente.mjs status` deve listar os agentes do
   projeto novo, e a página do escritório deve mostrar o selo "Ao vivo".
7. **Limpar o projeto antigo** (Vocação de Mãe), só depois de conferir:
   ```sql
   alter publication supabase_realtime drop table public.lisieux_agent_status;
   drop function if exists public.lisieux_set_status(text, text, text, text, text, text);
   drop table if exists public.lisieux_agent_status;
   drop table if exists public.lisieux_secrets;
   ```
   Isso apaga só o que é do escritório; nada do Vocação de Mãe.
8. Atualizar a tabela "Onde está hoje" deste arquivo.
