-- 0019_profiles_backfill.sql já tinha rodado (antes do avatar_url ter sido
-- adicionado nele) quando os usuários pré-existentes foram inseridos em
-- profiles — então o `on conflict (id) do nothing` de lá pula essas linhas
-- se rodar de novo, e o avatar_url delas nunca é preenchido. Este update
-- resolve só isso: só toca em quem já está com avatar_url nulo e tem o
-- dado disponível em raw_user_meta_data (login social) — nunca sobrescreve
-- um avatar que já tenha sido enviado pela tela de perfil.

update public.profiles p
set avatar_url = coalesce(
  u.raw_user_meta_data ->> 'avatar_url',
  u.raw_user_meta_data ->> 'picture'
)
from auth.users u
where p.id = u.id
  and p.avatar_url is null
  and coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') is not null;
