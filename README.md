# Alfred — Estrutura Inicial

Estrutura mínima do projeto: Next.js + TypeScript + Tailwind, com os tokens
de design (paleta e tipografia) já centralizados em `tailwind.config.ts`.

## Como rodar localmente

1. Instale as dependências:
   ```
   npm install
   ```

2. Copie o arquivo de variáveis de ambiente:
   ```
   cp .env.local.example .env.local
   ```
   Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com
   os valores do seu projeto Supabase (Project Settings > API).

3. Rode as migrations do banco: abra o **SQL Editor** do seu projeto Supabase
   e execute, nesta ordem, o conteúdo de:
   - `supabase/migrations/0001_init.sql` (cria as tabelas e as regras de segurança)
   - `supabase/seed.sql` (insere as categorias padrão)

4. Rode o projeto:
   ```
   npm run dev
   ```

5. Abra http://localhost:3000 — você será levado para `/login`. Crie uma conta
   e você cairá direto no dashboard.

## Estrutura

- `app/login/page.tsx` — tela de login/cadastro (Supabase Auth)
- `app/dashboard/page.tsx` — dashboard com dados reais do mês (Server Component)
- `app/lancamentos/novo/page.tsx` — tela de novo lançamento, já grava no banco
- `app/layout.tsx` — layout raiz, carrega as fontes Fraunces (títulos) e Inter (corpo/dados)
- `middleware.ts` — protege as rotas: redireciona para `/login` se não autenticado
- `tailwind.config.ts` — **tokens de design centralizados** (cores, tipografia). Para
  trocar a identidade visual, edite aqui — nunca direto nos componentes.
- `lib/supabase/client.ts` — cliente Supabase para componentes de cliente (formulários)
- `lib/supabase/server.ts` — cliente Supabase para Server Components (leitura de dados)
- `supabase/migrations/0001_init.sql` — schema do banco (contas, categorias, transações)
- `supabase/seed.sql` — categorias padrão

## Próximos passos (Wave 1)

- Tela de gerenciamento de categorias (criar/editar categorias próprias)
- Cadastro de contas múltiplas (hoje as transações já suportam `account_id`, falta a UI)
- Gráfico em rosca por categoria no dashboard
- Orçamento por categoria com alertas

Deploy configurado em 28/09/2026
