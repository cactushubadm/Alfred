-- Perfil do usuário: nome, telefone e avatar (hoje o app só usa o e-mail
-- de auth.users direto, isso abre espaço pra tela de perfil editável e pra
-- avatar de login social)

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "usuário vê apenas seu perfil"
  on profiles for select using (auth.uid() = id);
create policy "usuário edita apenas seu perfil"
  on profiles for update using (auth.uid() = id);

-- Sem policy de insert/delete de propósito: a única forma de criar uma
-- linha em profiles é o trigger abaixo (roda como security definer, então
-- não passa pela RLS) — o cliente nunca insere/exclui profile diretamente.

-- Cria a linha em profiles automaticamente a cada novo usuário em
-- auth.users. `name` e `avatar_url` vêm de raw_user_meta_data quando o
-- login é social (Google preenche `full_name`/`name` e `avatar_url`/
-- `picture` nesses metadados); no cadastro por e-mail/senha (sem
-- metadados) cai no fallback da parte local do e-mail, já que a coluna
-- `name` é obrigatória.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
