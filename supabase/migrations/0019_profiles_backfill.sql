-- O trigger de 0017_profiles.sql só roda em novo cadastro (after insert on
-- auth.users) — quem já tinha conta antes dessa migration não ganhou linha
-- em profiles. Backfill retroativo, seguro de rodar mais de uma vez: o
-- left join/`where p.id is null` já filtra quem falta, e o
-- `on conflict (id) do nothing` é um segundo cinto de segurança (ex.: um
-- cadastro novo concorrente cria a própria linha via trigger entre o SELECT
-- e o INSERT desse script).

insert into public.profiles (id, name, email, avatar_url, phone)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(u.email, '@', 1)
  ),
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'avatar_url',
    u.raw_user_meta_data ->> 'picture'
  ),
  null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
