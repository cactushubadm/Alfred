# Alfred — Contexto do Projeto

Leia este arquivo por completo antes de implementar qualquer coisa. Ele existe
para que você (Claude Code) continue o projeto sem precisar que o histórico de
decisões seja reexplicado a cada sessão.

## O que é o produto

App de controle financeiro + planejamento de investimentos, pensado como
produto (não só uso pessoal), web-first (responsivo), com modelo freemium
desde o início. Diferencial: unir controle de gastos do dia a dia com projeção
de patrimônio e independência financeira (aposentadoria/FIRE) no mesmo lugar.

Público-alvo: pessoas que já controlam a vida financeira de forma manual
(planilha, bloco de notas) e querem profissionalizar isso.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS — **tokens de design centralizados em `tailwind.config.ts`**;
  nunca usar cor "hardcoded" (hex direto) em componentes, sempre as classes
  utilitárias (`bg-forest`, `text-wine`, etc.)
- Supabase (Postgres + Auth), acesso via `@supabase/ssr`
  - `lib/supabase/client.ts` para Client Components
  - `lib/supabase/server.ts` para Server Components
  - `middleware.ts` protege rotas (redireciona para `/login` se não autenticado)
- framer-motion — micro-interações (números contando, anéis se desenhando,
  listas em cascata, feedback de toque, transição entre telas); ver seção
  "Micro-interações" abaixo antes de adicionar uma animação nova

## Identidade visual (não alterar sem confirmar com o usuário)

- Conceito: "crescimento silencioso" — anéis de progresso como linguagem
  visual recorrente (orçamento, metas, aposentadoria)
- Paleta: `forest` #1B4332 (primária), `sage` #F3F6F2 (fundo), `amber` #C9852E
  (destaques positivos), `wine` #8A1F2B (alertas/dívidas), `ink` #0E1512 (texto)
- Tipografia: Fraunces (`font-display`, títulos) + Inter (`font-sans`, corpo/dados)

### Tokens do modo escuro

`darkMode: "class"` configurado em `tailwind.config.ts`. Mesmo conceito
"crescimento silencioso", mesma família de cores, só recalibrada pra fundo
escuro.

**Regra que vale pros dois modos, claro e escuro**: nenhuma cor pode ser
escrita direto num componente (hex hardcoded ou `style={{ color: "..." }}`)
— toda cor, nova ou existente, precisa existir como token nomeado em
`colors` no `tailwind.config.ts` e ser usada só via classe utilitária
(`bg-forest`, `dark:text-sage-mint`, etc.), igual já vale pro modo claro
desde o início (seção "Stack"/"Convenções"). "Não inventar cor nova" nunca
significou "não adicionar token nenhum" — significa não trazer um tom fora
da paleta/conceito já validado. Por isso os 5 tokens abaixo
(`surface-dark`, `text-muted-dark`, `wine-dark`, `chart-clay-dark`,
`chart-slate-dark`) são adições legítimas: cada um é ou (a) a mesma cor já
usada no modo claro com outro papel (`ink`/`sage` viram fundo/texto
invertidos, sem token novo nenhum), ou (b) uma variante **do mesmo tom**
recalibrada só de luminosidade pra passar no contraste mínimo contra
`ink`/`surface-dark` (`wine-dark` é `wine` mais claro; `chart-clay-dark`/
`chart-slate-dark` são `chart-clay`/`chart-slate` mais claros) — nunca uma
cor nova sem relação com a paleta original. Qualquer token futuro (claro ou
escuro) deve seguir esse mesmo critério: reaproveitar um tom já existente
sempre que o contraste permitir, e só calibrar uma variante nova quando o
tom original reprovar WCAG AA na combinação necessária — nunca introduzir
uma família de cor desconectada da paleta sem confirmar com o usuário
antes.

- Fundo: `ink` #0E1512 (já existia, era só texto no modo claro)
- Superfície de cards: `surface-dark` #16211C (novo — um pouco mais claro
  que `ink`, pra dar profundidade sem virar outro tom da paleta)
- Texto principal: `sage` #F3F6F2 (já existia, era o fundo do modo claro)
- Texto secundário: `text-muted-dark` #9FB3A6 (novo — cinza-esverdeado
  claro; ~8,3:1 contra `ink` e ~7,5:1 contra `surface-dark`, folgado acima
  do mínimo AA de 4,5:1)
- Destaque de marca: `forest-light` #2D5A44 (já existia) — **só como
  preenchimento** (`bg-forest-light` + texto `sage`/branco por cima, ~7,3:1),
  nunca como cor de texto direto sobre `ink`/`surface-dark` (forest puro
  daria ~2,3:1 nessa combinação, bem abaixo do AA)
- `amber` #C9852E: conferido, já passa WCAG AA sobre fundo escuro sem
  ajuste (~6,1:1 contra `ink`, ~5,4:1 contra `surface-dark`)
- `wine` #8A1F2B: conferido e **reprovado** sobre fundo escuro (~2,0:1
  contra `ink`, ~1,8:1 contra `surface-dark` — bem abaixo do AA). Criado
  `wine-dark` #DB616F como variante só pro modo escuro (mesmo tom
  avermelhado, luminosidade ajustada pro mínimo de contraste: ~5,2:1 contra
  `ink`, ~4,7:1 contra `surface-dark`). `wine` original não muda — continua
  correto no modo claro (~8,3:1 contra `sage`/branco)

### Troca de tema

- Coluna `profiles.theme_preference` (`0021_profiles_theme_preference.sql`):
  `text`, `check` em `'light' | 'dark' | 'system'`, default `'system'`
- `components/theme/ThemeProvider.tsx`: contexto React (`useTheme()` →
  `{ preference, resolvedTheme, setPreference }`), monta no
  `app/layout.tsx` por fora do `MotionProvider`. Ao trocar a preferência:
  aplica a classe `dark` no `<html>` na hora, grava em `localStorage`
  (chave `theme-preference`) e persiste em `profiles.theme_preference` em
  segundo plano (melhor esforço — não bloqueia a troca visual, que já
  aconteceu via localStorage). Se a preferência for `"system"`, ouve
  `matchMedia("(prefers-color-scheme: dark)")` e re-resolve ao vivo se o SO
  trocar de tema com o app aberto
- Sem flash no primeiro paint: `app/layout.tsx` tem um `<script>` inline no
  `<head>` (roda antes do React hidratar) que lê o mesmo `localStorage` e já
  aplica a classe `dark` no `<html>` — por isso o `<html>` tem
  `suppressHydrationWarning` (o React vê um `className` diferente do que
  ele mesmo renderizou no servidor, mas é intencional). A chave lida por
  esse script precisa continuar batendo com a `STORAGE_KEY` do
  `ThemeProvider.tsx` se uma delas mudar
- Sincronia entre dispositivos: no mount, o `ThemeProvider` busca
  `profiles.theme_preference` do usuário logado e, se divergir do que já
  está no `localStorage` desse navegador (ex.: primeira vez nesse
  dispositivo, ou preferência trocada em outro), assume o valor do banco —
  localStorage já resolveu o primeiro paint instantâneo, isso só corrige
  depois, sem re-render brusco perceptível na maioria dos casos
- Toggle "Claro / Escuro / Sistema" em `app/perfil/ProfileForm.tsx` — só
  tokens existentes (`bg-forest`/`text-white` pro ativo, `border-line-soft`/
  `text-text-muted` pro inativo), aplica na hora ao tocar, sem precisar do
  botão "Salvar" (que é só pra nome/telefone)

### Classes `dark:` aplicadas nas telas

Todas as telas do app (sem exceção) já têm as variantes `dark:` aplicadas:
login, dashboard + `BudgetDonut`/`HealthScoreRing`/`RecentTransactions`,
novo lançamento, edição de lançamento, categorias, contas, cartão
(`cartoes/[id]`), simulador de investimento, aposentadoria, metas, dívidas,
patrimônio líquido + `NetWorthChart`, fluxo de caixa, contas a pagar/receber
+ `PendingList`, notificações, estimativa de compra, relatório mensal e
perfil + `ProfileForm` — junto com os componentes compartilhados usados por
elas (`BottomNav`, `ConfirmDialog`, `ToggleSwitch`, `InfoTooltip`,
`CategoryPicker`, `Skeleton`) e os 6 `loading.tsx` que já existiam
(dashboard/metas/dívidas/patrimônio/fluxo de caixa/relatórios — as 5 telas
adicionadas depois não têm `loading.tsx` próprio, então não precisaram
desse ajuste).

Mapeamento usado (mesmo par light→dark em toda tela nova; seguir isso em
vez de inventar uma combinação diferente):

| Light | Dark | Uso |
|---|---|---|
| `bg-sage` | `dark:bg-ink` | fundo da tela |
| `bg-white` | `dark:bg-surface-dark` | cards/superfícies |
| `text-ink` | `dark:text-sage` | texto principal |
| `text-text-muted` | `dark:text-text-muted-dark` | texto secundário |
| `border-line-soft` | `dark:border-text-muted-dark/20` | bordas/divisores |
| `bg-line-soft` | `dark:bg-text-muted-dark/20` | trilho de barra/progresso |
| `text-forest`/`border-forest` (como texto/borda, não preenchimento) | `dark:text-sage-mint` | link/ação em destaque |
| `text-wine`/`border-wine` | `dark:text-wine-dark`/`dark:border-wine-dark` | alerta/erro |

`bg-forest`, `bg-wine`, `bg-amber` como **preenchimento** (com texto branco/
sage por cima, ex. banners e botões) não mudam — já funcionam nos dois
modos, porque o que importa ali é o contraste entre o preenchimento e o
texto em cima, não entre o preenchimento e o fundo da página.

Gráficos (rosca do dashboard, barras de patrimônio e de evolução por ano do
simulador) precisaram de atenção extra, como pedido: `forest`/`forest-light`
puros como fatia/barra reprovam contraste sobre `surface-dark` (é
preenchimento, mas SEM texto por cima — o correto ali é comparar com o
fundo do card, e reprovam ~1,5-2,3:1). Toda fatia/barra que usava essas
cores ganhou `dark:bg-sage-mint`/`dark:stroke-sage-mint` (reaproveitando o
tom já existente) — exceto as 2 cores extras do gráfico de categorias do
dashboard (`chart-clay`, `chart-slate`), que também reprovavam e ganharam
variantes calibradas novas (`chart-clay-dark` #C8775F, `chart-slate-dark`
#8BA4B2, mesmo espírito do `wine-dark`) porque não havia um tom já existente
pra reaproveitar sem colidir com as outras fatias do mesmo gráfico. O trilho
de fundo do anel (`stroke-line-soft`) segue o mesmo padrão de bordas/
divisores acima.

## Navegação

A tela inicial (`app/dashboard/page.tsx`) não tem mais botões soltos pra
cada módulo — a navegação entre módulos vive inteira em
`components/BottomNav.tsx`, que expõe dois painéis:

- **"+" central** (`CREATE_ITEMS`): leque em cascata com as 7 ações de
  criar algo novo (despesa, receita, transferência, meta, dívida, compra
  planejada, conta/cartão). Cada item já leva a tela de destino direto pro
  modo de criação via query string — `/lancamentos/novo?type=despesa|receita|transferencia`
  (o `type` inicial é lido de `searchParams` em vez de sempre nascer em
  "despesa") e `?new=1` nas telas de listar+criar (metas, dívidas,
  estimativa de compra, contas), que abrem `showNewForm` já `true` quando
  o parâmetro está presente.
- **Botão de menu** (`CONSULTA_ITEMS`): painel (bottom sheet) com as 9
  telas de consulta (investimentos, aposentadoria, dívidas, patrimônio,
  fluxo de caixa, contas a pagar/receber, relatórios, categorias, e o
  score de saúde financeira — que não tem tela própria, ancora em
  `/dashboard#score`, o `id="score"` está no `HealthScoreRing`).

Toda tela nova de "criar algo" ou "consultar algo" deve ser adicionada em
`CREATE_ITEMS` ou `CONSULTA_ITEMS` nesse arquivo — não criar botão solto de
navegação em nenhuma outra tela. Os dois painéis fecham ao tocar fora
(backdrop) e respeitam `prefers-reduced-motion` (`motion-reduce:` do
Tailwind, sem JS). Como cada `page.tsx` renderiza seu próprio
`<BottomNav />` (não há layout compartilhado), qualquer `loading.tsx`
também precisa incluir `<BottomNav />` — ver seção de convenções abaixo.
Páginas client que leem `useSearchParams()` (as 5 citadas acima) precisam
do componente principal separado num `XInner()` e do `export default`
envolvendo com `<Suspense>` — sem isso o `npm run build` quebra
("useSearchParams() should be wrapped in a suspense boundary").

## Micro-interações

Ritmo (durações, curvas de easing, atraso de cascata) todo centralizado em
`lib/motion.ts` — é o único arquivo pra mexer se quiser o app mais rápido/
lento ou mudar a curva. Três durações (`DURATION.tap` 0.15s, `.fast` 0.2s,
`.base` 0.3s, `.slow` 0.45s) e duas curvas (`EASE.quiet`, um easeOut suave
sem overshoot — a padrão pra quase tudo; `EASE.standard`, easeInOut
simétrico, só pra transição de tela). Nada usa framer-motion sem passar por
esses componentes prontos em `components/motion/`:

- `AnimatedNumber` — conta de 0 (ou do valor anterior, se já montado) até
  `value`; usado nos valores monetários principais (recebido/gasto/saldo do
  dashboard e do relatório, patrimônio líquido/ativos/passivos, saldo
  projetado do fluxo de caixa) e no número do score de saúde. Sob
  `prefers-reduced-motion`, pula direto pro valor final (`motionValue.jump`)
  em vez de contar.
- `AnimatedRingReveal` — "desenha" um anel/rosca ao carregar aplicando uma
  máscara SVG que cresce de 0% a 100% por cima do grupo passado como
  children; usado no `BudgetDonut` (dashboard) e no `HealthScoreRing`. Não
  mexe no `strokeDasharray` de cada fatia (isso continua calculado do jeito
  que já era), só revela o que já está desenhado.
- `StaggerList` / `StaggerItem` — entrada em cascata (fade + slide de 8px)
  pras listas (lançamentos, metas, dívidas, contas, categorias, contas a
  pagar, notificações, fluxo de caixa projetado, itens do relatório). Uma
  lista que muda de conteúdo por causa de um filtro/aba (ex.: categorias
  trocando despesa/receita) recebe `key={filtro}` no `StaggerList` pra
  cascata replay quando troca.
- `PressableButton` / `PressableLink` — encolhem sutilmente (`TAP_SCALE`
  0.97) ao toque; usados nos botões/links mais tocados de cada tela
  (editar/excluir, criar, marcar como pago, trocar de mês/aba). Nem todo
  botão do app precisa disso — só os de ação mais frequente.
- `app/template.tsx` — fade (nunca x/y/scale!) entre navegações de tela.
  Só opacity de propósito: como cada `page.tsx` renderiza seu próprio
  `<BottomNav />` com `position: fixed`, um transform em qualquer ancestral
  (mesmo que só durante a animação) vira containing block e quebra esse
  fixed até a transição terminar — fade puro não tem esse problema.

`prefers-reduced-motion` é respeitado em duas camadas: `MotionConfig
reducedMotion="user"` (`components/motion/MotionProvider.tsx`, no
`app/layout.tsx`) torna instantâneas as animações de transform/layout
(`whileTap`, cascata de lista, fade de tela) sozinho, sem precisar de if em
cada componente — só o crossfade de opacidade continua, que é o
comportamento oficial do framer-motion pra esse modo. Como isso não cobre
atributos SVG arbitrários nem `animate()` imperativo, `AnimatedNumber` e
`AnimatedRingReveal` conferem `useReducedMotion()` na mão e pulam direto pro
estado final. É uma estratégia um pouco diferente do `motion-reduce:` do
Tailwind usado em `components/BottomNav.tsx` (que desliga tudo, sem exceção
de opacidade) — ambas são válidas, só não espere exatamente o mesmo
comportamento entre uma tela animada com framer-motion e o menu inferior.

Ao adicionar uma tela/lista nova: reaproveite esses componentes em vez de
escrever uma animação nova solta — é o que mantém o "ritmo" ajustável num
lugar só.

## Autenticação e perfil

Tabela `profiles` (`0017_profiles.sql`): `id` é a própria FK pra
`auth.users(id)` (sem `user_id` separado), `name`/`email` obrigatórios,
`phone`/`avatar_url` nulos. RLS só com select/update do próprio usuário
(`auth.uid() = id`) — sem policy de insert/delete de propósito: a única
forma de criar a linha é o trigger `on_auth_user_created` →
`public.handle_new_user()` (`security definer`), disparado em `after insert
on auth.users`, que preenche `name`/`avatar_url` a partir de
`raw_user_meta_data` quando o cadastro é social (Google: `full_name`/`name`
e `avatar_url`/`picture`) ou cai no fallback da parte local do e-mail no
cadastro por e-mail/senha. Como o trigger só roda em cadastro novo, contas
anteriores à migration 0017 foram cobertas por dois backfills retroativos
(rodados manualmente no SQL Editor, nunca automático — mexem com dado real
de usuário): `0019_profiles_backfill.sql` (cria a linha faltante, mesma
lógica de nome/avatar do trigger; seguro de rodar mais de uma vez via
`left join ... where p.id is null` + `on conflict (id) do nothing`) e
`0020_profiles_avatar_backfill.sql` (só preenche `avatar_url` de quem já
tinha sido criado pelo backfill anterior, antes do avatar_url ter sido
adicionado nele).

Cadastro por e-mail/senha (`app/login/page.tsx`) coleta "Nome completo"
(obrigatório) e "Telefone" (opcional, máscara BR via `lib/phone.ts`,
compartilhada com a edição de perfil); depois do `supabase.auth.signUp`, um
`update` em `profiles` completa esses dois campos por cima do que o trigger
já criou.

Login social com Google: botão "Continuar com Google" em
`app/login/page.tsx` chama `supabase.auth.signInWithOAuth({ provider:
"google", options: { redirectTo: ".../auth/callback" } })`.
`app/auth/callback/route.ts` troca o `code` pela sessão
(`exchangeCodeForSession`) e redireciona pro dashboard, mesmo destino do
login por e-mail/senha; se der erro, volta pro `/login`. `middleware.ts`
tem uma exceção pra `/auth/callback` em `isPublicRoute` — sem ela, o
middleware redireciona pro `/login` antes da troca de código acontecer,
porque essa rota chega sem sessão ainda. Requer o provider Google
configurado no painel do Supabase (Client ID/Secret do Google Cloud
Console) — configuração externa, não dá pra fazer por código.

Bucket `avatars` do Supabase Storage (`0018_avatars_storage.sql`): público
(foto de perfil não é dado sensível, mais simples servir por URL pública
direto sem gerar signed URL toda hora), com RLS de `storage.objects`
escopada por pasta — só o dono sobe/atualiza/exclui arquivos dentro de
`{auth.uid()}/...` (via `storage.foldername(name)`). Upload feito em
`app/perfil/ProfileForm.tsx`: caminho fixo `{userId}/avatar` sem extensão
(`contentType` explícito no upload) com `upsert: true`, pra nunca sobrar
avatar antigo órfão no bucket; a URL pública ganha `?t=timestamp` a cada
upload pra não ficar presa em cache do navegador (mesmo caminho, conteúdo
novo). Sem foto, mostra as iniciais do nome (`components/Avatar.tsx`).

Tela de perfil (`app/perfil/page.tsx` + `ProfileForm.tsx`): nome e telefone
editáveis, e-mail só leitura (não dá pra trocar por aqui). O dashboard
(`app/dashboard/page.tsx`) busca `profiles.name`/`avatar_url` na mesma
consulta paralela de sempre — mostra "Olá, {primeiro nome}" (fallback pro
prefixo do e-mail se o profile não existir ou o nome vier vazio) e a foto
de verdade no ícone de "Perfil" do header, reaproveitando o mesmo
`components/Avatar.tsx` (fallback nas iniciais, com `ring-white/25` de
contorno já que o fundo do header usa a mesma cor `bg-forest` do fallback).

- [x] Tabela `profiles` com RLS e trigger de criação automática
- [x] Backfill retroativo pra contas anteriores à tabela `profiles`
      (nome/e-mail e, depois, avatar_url)
- [x] Login social com Google (botão + callback + exceção no middleware)
- [x] Bucket `avatars` no Storage com RLS por dono
- [x] Tela de perfil editável (nome, telefone, foto) e integração no
      dashboard (saudação com nome real + avatar no header)

## Modelo de dados atual

Ver `supabase/migrations/0001_init.sql`. Tabelas: `accounts`, `categories`
(com `user_id` nulo = categoria padrão do sistema), `transactions`. Todas com
RLS por `user_id`. Ao criar novas tabelas, seguir o mesmo padrão de RLS.

Tabela `profiles` (autenticação/perfil do usuário) documentada na seção
"Autenticação e perfil", logo acima.

## O que já está implementado (Wave 1, em andamento)

- [x] Autenticação (login/cadastro) — `app/login/page.tsx`
- [x] Middleware de proteção de rotas
- [x] Dashboard com dados reais do mês (recebido, gasto, saldo, lançamentos
      recentes) — `app/dashboard/page.tsx`
- [x] Novo lançamento (receita/despesa) conectado ao banco — `app/lancamentos/novo/page.tsx`
- [x] Categorias padrão via seed (`supabase/seed.sql`)

## Backlog por wave (fazer nesta ordem)

### Wave 1 — finalizar o essencial
- [x] Tela de gerenciamento de categorias: listar, criar categoria própria,
      editar, excluir, definir orçamento mensal por categoria —
      `app/categorias/page.tsx`
- [x] Cadastro de contas múltiplas (UI para a tabela `accounts`, que já existe
      no banco): criar conta, escolher tipo, transações já têm `account_id` —
      `app/contas/page.tsx`
- [x] Transferência entre contas (não deve contar como receita/despesa nos
      totais) — `app/lancamentos/novo/page.tsx` (tipo "transferencia"),
      `supabase/migrations/0002_transfers.sql`
- [x] Gráfico em rosca no dashboard: gasto por categoria + "quanto ainda pode
      gastar" no centro, usando o `monthly_budget` de cada categoria —
      `app/dashboard/BudgetDonut.tsx`
- [x] Alertas de orçamento (ex: 90% do orçamento de uma categoria usado) —
      `app/dashboard/BudgetDonut.tsx`
- [x] Edição e exclusão de lançamentos —
      `app/lancamentos/[id]/editar/page.tsx`, `app/dashboard/RecentTransactions.tsx`
- [x] Lógica de recorrência: transação com `is_recurring = true` deve gerar o
      lançamento do mês seguinte automaticamente — geração sob demanda ao
      abrir o dashboard (`lib/recurring.ts`,
      `supabase/migrations/0003_recurring.sql`); ver decisão sobre cron vs.
      on-demand no histórico do projeto
- [x] Comparativo entre meses (mês atual vs anterior) — `app/dashboard/page.tsx`
      (função `monthChange`)

### Wave 2 — projeção financeira (diferencial do produto)
- [x] Tabela `investment_profiles` (aporte mensal, taxa esperada, patrimônio
      atual, `type` 'reserva'/'longo_prazo') —
      `supabase/migrations/0005_investment_profiles.sql`
- [x] Simulador de aportes com juros compostos: `VF = VP(1+i)^n + PMT*[((1+i)^n-1)/i]`
      (i = taxa mensal equivalente à taxa anual) — `app/investimentos/page.tsx`
      (função `futureValue`)
- [x] Tabela `retirement_plans` (renda mensal desejada, taxa de retirada —
      padrão 4% a.a./0.04 em fração, configurável, taxa de inflação
      considerada) — `supabase/migrations/0008_retirement_plans.sql`
- [x] Calculadora de aposentadoria/FIRE: patrimônio necessário = renda mensal
      desejada × 12 / taxa de retirada; quanto falta vs. patrimônio de
      longo prazo; anos até a meta isolando `n` da fórmula de juros
      compostos; comparador de cenários "e se aportasse mais" —
      `app/aposentadoria/page.tsx`
- [x] Separação reserva de emergência vs investimento de longo prazo —
      reserva usa registro mês a mês de quanto guardou/retirou (sem aporte
      fixo) e rendimento simples (sem juros compostos); longo prazo usa
      aporte fixo + juros compostos — `app/investimentos/page.tsx`,
      `supabase/migrations/0006_reserve_movements.sql`,
      `0007_reserve_movements_history.sql`
- [x] Exibir valor nominal vs valor real: `VF_real = VF_nominal / (1+inflação)^n`
      — `app/investimentos/page.tsx` (aba longo prazo, lado a lado, cada um
      rotulado); usado também na direção inversa (real → nominal numa data
      futura) em `app/aposentadoria/page.tsx`
- [x] Tabela `goals` (metas de curto/médio prazo com valor-alvo e data-alvo),
      tela com barra de progresso e cálculo de quanto guardar por mês —
      `supabase/migrations/0009_goals.sql`, `app/metas/page.tsx`

### Wave 3 — controle financeiro avançado
- [x] Cartão de crédito como entidade própria: `accounts` ganhou `closing_day`
      e `due_day` (limite já existia), e a parcela 1 de uma despesa parcelada
      é a própria transação enquanto as parcelas futuras (2..N) ficam na
      tabela `installments` (parcelamentos em andamento já comprometidos) —
      `supabase/migrations/0010_credit_cards.sql`, `app/contas/page.tsx`,
      `app/lancamentos/novo/page.tsx`. Tela da fatura: fatura atual (soma do
      ciclo de fechamento vigente), limite disponível (limite − fatura atual
      − parcelas futuras além do ciclo atual, não só a fatura do mês) e
      lista de parcelas em aberto com quantas ainda faltam —
      `app/cartoes/[id]/page.tsx`
- [x] Contas a pagar/receber com vencimento e lembretes (usar `due_date` e
      `status` que já existem na tabela `transactions`): lista de lançamentos
      pendentes ordenados por vencimento, atraso calculado on-the-fly
      (`due_date` no passado + status ainda `pendente`/`atrasado`, sem job
      de fundo — mesmo espírito da recorrência), com destaque visual pros
      atrasados e ação de marcar como pago — `app/contas-a-pagar/page.tsx`,
      `app/contas-a-pagar/PendingList.tsx`; entrada a partir do dashboard —
      `app/dashboard/page.tsx`
- [x] Tabela `debts` (saldo devedor, taxa de juros mensal, parcela mensal,
      parcelas restantes, `type` cartão/empréstimo/financiamento/cheque
      especial) + simulador de quitação avalanche (maior taxa primeiro) vs.
      bola de neve (menor saldo primeiro): ordem fixada pelo estado inicial,
      simulação mês a mês com juros sobre o saldo e o "extra" informado
      (mais os pagamentos mínimos liberados pelas dívidas já quitadas)
      aplicado só à dívida prioritária da vez; mostra tempo total até quitar
      tudo e total de juros pago em cada estratégia —
      `supabase/migrations/0011_debts.sql`, `app/dividas/page.tsx`. Alerta no
      dashboard: se o custo anual equivalente de alguma dívida (juros
      mensais compostos ao ano) for maior que a `expected_annual_rate` do
      perfil de investimento de longo prazo, sugere quitar a dívida antes de
      aportar, mostrando a diferença em pontos percentuais —
      `app/dashboard/page.tsx`
- [x] Patrimônio líquido (net worth): ativos (saldo das contas exceto
      cartão, já que o crédito usado vira passivo via `installments` — +
      reserva de emergência [saldo inicial do perfil + histórico de
      `reserve_movements`] + saldo do investimento de longo prazo) menos
      passivos (`debts.balance` + parcelas de `installments` ainda não
      vencidas) — `lib/netWorth.ts`. Tabela `net_worth_snapshots` guarda um
      snapshot por mês, gerado sob demanda ao abrir a tela (mesmo espírito
      da geração on-demand dos lançamentos recorrentes — sem job de fundo),
      alimentando o gráfico de evolução mês a mês —
      `supabase/migrations/0012_net_worth_snapshots.sql`,
      `app/patrimonio/page.tsx`. Meses sem visita não ficam sem registro:
      são preenchidos por carry-forward do último snapshot conhecido e
      marcados `estimated = true` (coluna adicionada em
      `0013_net_worth_estimated.sql`), exibidos com opacidade reduzida no
      gráfico; ao reabrir a tela, o mês corrente é sempre recalculado com
      valores reais — `lib/netWorth.ts` (`monthsBetweenExclusive`)
- [x] Fluxo de caixa projetado (próximos 30/60/90 dias): soma três fontes —
      lançamentos recorrentes ainda não materializados (simulados mês a mês
      a partir da ponta de cada cadeia com `addOneMonth`, sem gravar nada
      no banco), parcelas futuras de `installments` e contas a
      pagar/receber (`status` pendente/atrasado) com `due_date` no período
      — `lib/cashFlow.ts` (`projectCashFlow`), `app/fluxo-de-caixa/page.tsx`;
      entrada a partir do dashboard — `app/dashboard/page.tsx`

### Wave 4 — decisão e engajamento
- [x] Módulo de estimativa de compra (à vista vs. parcelado): tabela
      `purchase_intents` (nome, valor à vista, número de parcelas, se há
      juros embutidos e a taxa mensal do parcelamento) —
      `supabase/migrations/0014_purchase_intents.sql`. Um único cálculo
      cobre os dois cenários do PRD: a parcela é a amortização (Tabela
      Price) do valor à vista na taxa do parcelamento (`0%` quando não há
      juros, o que degenera pra divisão simples) — `amortizationPayment`;
      depois simula guardar o valor à vista investido e usá-lo pra pagar
      cada parcela conforme vence, reaproveitando a fórmula de juros
      compostos com aportes da Wave 2 (`futureValue`, agora em
      `lib/finance.ts` — extraída de `app/investimentos/page.tsx`, que
      passou a importar de lá) com o aporte mensal negativo, à taxa
      esperada de `investment_profiles` (`longo_prazo`). Saldo final
      positivo = "parcelar e investir a diferença renderia R$X a mais";
      negativo = "pagar à vista evita R$Y de juros" — o mesmo resultado já
      reflete a comparação entre a taxa efetiva do parcelamento e a do
      investimento — `app/estimativa-de-compra/page.tsx`. "Melhor época pra
      comprar": sobra livre por mês = média do fluxo de caixa projetado da
      Wave 3 (`projectCashFlow`, 90 dias) menos o que as metas ativas
      (`goals`) já exigem por mês (`goalMonthlyRequirement`, nova em
      `lib/finance.ts`); a reserva de emergência (`investment_profiles`
      tipo `reserva` + `reserve_movements`) nunca é usada como fonte pra
      essa compra — só vira um aviso se ainda não atingiu a meta mínima (6x
      gastos médios, mesmo cálculo de `app/investimentos/page.tsx`). Mostra
      em quantos meses (e mês/ano estimado) dá pra comprar à vista com essa
      sobra, e se a parcela já cabe nela hoje — `app/estimativa-de-compra/page.tsx`
- [x] Score de saúde financeira (nota 0–100), exibido no dashboard como um
      anel (mesma linguagem visual de orçamento/metas/aposentadoria) —
      `app/dashboard/HealthScoreRing.tsx`. Fórmula v1 (pesos deliberadamente
      simples, documentados em `lib/healthScore.ts` pra ajustar com base em
      feedback real de uso): média ponderada de 4 componentes 0-100 —
      poupança do mês = saldo/recebido (peso 0.35, 0% ou menos → 0, 20%+ →
      100, linear); % de categorias com orçamento definido que ficaram
      dentro do limite (peso 0.25); reserva atual / meta de 6x gastos
      médios (peso 0.25, usando `lib/reserve.ts`, extraído de
      `app/estimativa-de-compra/page.tsx` pra não duplicar o cálculo); % de
      dívidas em aberto cuja taxa anualizada NÃO supera a
      `expected_annual_rate` do investimento de longo prazo (peso 0.15, sem
      dívida nenhuma = 100 — reaproveita a mesma comparação do alerta
      "quitar antes de investir"). Componente sem dado suficiente fica fora
      da média (pesos dos demais são renormalizados); se não há nenhum
      sinal real de atividade (nem transação no mês, nem orçamento, nem
      reserva, nem dívida cadastrada), o score não é exibido em vez de
      mostrar um número artificial — `lib/healthScore.ts`
- [x] Notificações inteligentes: centro de notificações gerado sob demanda
      (sem job de fundo) em `lib/notifications.ts` (`getNotifications`),
      exibido em `app/notificacoes/page.tsx` e com sino + contador no
      cabeçalho do dashboard. 4 tipos: (1) categoria perto/estourando o
      orçamento — regra `isBudgetAlert` centralizada e reaproveitada pelo
      anel do dashboard (`app/dashboard/BudgetDonut.tsx`) e pelo centro de
      notificações, pra nunca divergir; (2) conta (`transactions.due_date`)
      ou parcela (`installments.due_date`) vencendo em até 3 dias, ou já
      atrasada; (3) meta em risco: como `goals` não guarda histórico de
      aportes, usa como proxy do "ritmo atual" a média real de saldo
      (recebido−gasto) dos últimos 3 meses — se o quanto a meta exige por
      mês (`goalMonthlyRequirement`) for maior que essa média, entra como
      risco (simplificação documentada em `lib/notifications.ts`); (4)
      dívida cara — reaproveita exatamente o alerta da Wave 3
      (`getDebtAlerts`, extraído do dashboard, agora fonte única também
      usada no cálculo do score de saúde financeira)
- [x] Relatórios mensais automáticos: por enquanto só como tela no app (sem
      e-mail ainda — fica pra quando o serviço de e-mail transacional for
      configurado). Tabela `monthly_reports` (recebido, gasto, saldo, saldo
      do mês anterior, categoria que mais pesou, progresso das metas em
      jsonb, score de saúde financeira) —
      `supabase/migrations/0015_monthly_reports.sql`. Mês corrente é sempre
      regerado a cada visita (ainda em andamento); meses passados, uma vez
      gerados, ficam congelados — porque `goals.current_amount` e os
      insumos do score não têm histórico próprio, só o estado no momento da
      geração (mesma limitação do "ritmo de contribuição" das metas em
      `lib/notifications.ts`), então recomputar depois fingiria uma
      precisão histórica que os dados não sustentam. Recebido/gasto/saldo/
      categoria são sempre exatos pra qualquer mês (vêm de `occurred_at`,
      data real) — `lib/monthlyReport.ts`, `app/relatorios/page.tsx`.
      Navegação por mês com histórico de relatórios já gerados; comparação
      com o mês anterior reaproveita `monthChange` (extraída de
      `app/dashboard/page.tsx` pra `lib/finance.ts`). Navegação também vai
      pra meses futuros (limite de 24 meses à frente, `FUTURE_MONTHS_CAP`
      em `app/relatorios/page.tsx`): em vez de gerar/congelar um
      `monthly_report`, mostra uma **previsão** (selo "Previsto" + tokens
      com opacidade reduzida, ex. `text-forest/70`, `border-dashed`) usando
      só o que já é conhecido — recorrentes, parcelas de `installments` e
      contas a pagar/receber com vencimento naquele mês — via
      `projectMonthCashFlow` (nova em `lib/cashFlow.ts`, recorta
      `projectCashFlow` já existente pro intervalo do mês pedido, em vez de
      duplicar a lógica de quais fontes entram na previsão). Sem categoria
      que mais pesou, progresso de metas ou score pra meses futuros —
      exigiriam inventar gasto variável ou estado que ainda não existe.
      `monthBounds`/`pad2` foram extraídas de `lib/monthlyReport.ts` pra
      `lib/finance.ts` (compartilhadas com `lib/cashFlow.ts`)

### Wave 5 — IA e escala
- [ ] Chat com "analista financeiro" (IA) com contexto dos dados do usuário —
      feature premium; sempre exibir disclaimer de que não é consultoria
      financeira regulada
- [ ] Importação via Open Finance
- [ ] Exportação de dados (CSV/PDF)
- [ ] Expansão para app mobile nativo (React Native/Flutter), reaproveitando
      a mesma modelagem de dados

## Ajustes pós-Wave 4

Polimento feito depois da Wave 4 fechar, antes de começar a Wave 5 — não
eram itens do backlog original, vieram de feedback de uso. Detalhe completo
de cada um já está nas seções "Navegação", "Micro-interações" e no item de
relatórios mensais da Wave 4; aqui é só o checklist de que está feito.

- [x] Navegação reorganizada: removidos os botões soltos de módulo da tela
      inicial; toda navegação passou pra `components/BottomNav.tsx` — "+"
      central abre um leque em cascata pra **criar** algo novo (despesa,
      receita, transferência, meta, dívida, compra planejada, conta/cartão),
      botão de menu abre um painel pra **consultar** os módulos (investimentos,
      aposentadoria, dívidas, patrimônio, fluxo de caixa, contas a
      pagar/receber, relatórios, categorias, score de saúde). Ver seção
      "Navegação"
- [x] Relatório mensal ganhou navegação pra meses futuros com **previsão**
      (baseada só em recorrentes/parcelas/contas a pagar já cadastradas, sem
      inventar gasto variável), reaproveitando o fluxo de caixa projetado da
      Wave 3 via `projectMonthCashFlow`. Barra de mês depois simplificada:
      sem input de calendário nem botão "Ver" — só "Anterior · Mês · Próximo",
      atualizando sozinha. Ver item de relatórios mensais na Wave 4
- [x] Convenção de micro-interações com framer-motion: ritmo (durações,
      curvas, atraso de cascata) centralizado em `lib/motion.ts`, aplicado
      via os componentes prontos de `components/motion/` (números contando,
      anéis se desenhando, listas em cascata, feedback de toque, transição
      de tela) — sempre respeitando `prefers-reduced-motion`. Ver seção
      "Micro-interações"
- [x] Tabela `profiles`, login social com Google, bucket `avatars` no
      Storage e tela de perfil editável (nome, telefone, foto — e-mail só
      leitura), com o dashboard mostrando nome real e avatar no header. Ver
      seção "Autenticação e perfil"
- [x] Modo escuro completo: tokens recalibrados em `tailwind.config.ts`
      (`darkMode: "class"`), `ThemeProvider` (contexto React + coluna
      `profiles.theme_preference` + `localStorage`, sem flash no primeiro
      paint) e as variantes `dark:` aplicadas em 100% das telas do app,
      sem nenhuma cor fora dos tokens já definidos. Ver seções "Tokens do
      modo escuro", "Troca de tema" e "Classes `dark:` aplicadas nas
      telas"

## Convenções ao implementar

- Toda tabela nova precisa de RLS com policies por `user_id`, seguindo o
  padrão de `0001_init.sql`
- Toda nova migration vai em `supabase/migrations/000N_nome.sql`, numerada
  sequencialmente
- Formulários que gravam dados são Client Components (`"use client"`) usando
  `lib/supabase/client.ts`; telas que só leem dados devem ser Server
  Components usando `lib/supabase/server.ts` sempre que possível (melhor
  performance, menos JS no cliente)
- Valores monetários sempre em `numeric(12,2)` no banco e formatados com
  `toLocaleString("pt-BR", { style: "currency", currency: "BRL" })` no front
- Não introduzir nova paleta de cores ou fonte sem confirmar com o usuário —
  a identidade visual já foi validada e documentada no PRD
- Rota com tela "pesada" (várias consultas ao Supabase) precisa de
  `loading.tsx` com skeleton nos tokens de design (`components/Skeleton.tsx`)
  — todo `page.tsx` já renderiza seu próprio `<BottomNav />` (não tem layout
  compartilhado), então o `loading.tsx` também precisa incluir
  `<BottomNav />`, senão ela some durante a navegação
- Consultas independentes ao Supabase numa mesma página/função devem rodar
  em paralelo com `Promise.all`, nunca uma de cada vez — só manter sequencial
  quando há dependência real de dados (ex.: `generateDueRecurringTransactions`
  precisa terminar antes de ler as transações do mês; ler `net_worth_snapshots`
  depois de escrever o snapshot do mês corrente)
- Colunas muito filtradas (`user_id`, `occurred_at`, `due_date`, `status`)
  precisam de índice — checar isso ao criar uma tabela ou uma query nova
- Teste de velocidade real é sempre `npm run build && npm start` — `npm run
  dev` não recompila com as otimizações de produção e mascara o número real
