-- Categorias por usuário
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0003.
--
-- Antes: categorias padrão eram linhas COMPARTILHADAS (user_id nulo),
-- visíveis pra todo mundo e bloqueadas por RLS pra edição/exclusão (senão a
-- edição de um usuário mudaria a categoria pra todos os outros).
--
-- Agora: cada usuário recebe sua PRÓPRIA cópia das categorias padrão, então
-- toda categoria que ele vê é dele — editar e excluir funcionam sem caso
-- especial em lugar nenhum.

-- 1. Dá uma cópia das categorias padrão pra cada usuário que já existe.
--    (idempotente: pode rodar de novo sem duplicar)
insert into categories (user_id, name, icon, type, monthly_budget)
select u.id, c.name, c.icon, c.type, c.monthly_budget
from auth.users u
cross join categories c
where c.user_id is null
  and not exists (
    select 1 from categories existing
    where existing.user_id = u.id
      and existing.name = c.name
      and existing.type = c.type
  );

-- 2. A partir de agora, todo novo usuário recebe a cópia automaticamente
--    no cadastro.
create or replace function public.copy_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, icon, type, monthly_budget)
  select new.id, name, icon, type, monthly_budget
  from public.categories
  where user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_copy_categories on auth.users;
create trigger on_auth_user_created_copy_categories
  after insert on auth.users
  for each row execute function public.copy_default_categories();

-- 3. As linhas com user_id nulo viram só o "molde" usado pela função acima
--    — deixam de aparecer pra qualquer usuário (cada um já tem sua própria
--    cópia editável).
drop policy if exists "usuário vê categorias padrão e as suas" on categories;
create policy "usuário vê suas categorias"
  on categories for select using (auth.uid() = user_id);
