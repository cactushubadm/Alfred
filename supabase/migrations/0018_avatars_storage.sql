-- Bucket público de avatares (app/perfil) — público porque a foto de
-- perfil não é dado sensível e fica mais simples servir via URL pública
-- direto, sem gerar signed URL toda hora. Upload/edição continuam restritos
-- ao próprio dono via RLS, escopado por pasta: cada usuário só mexe em
-- arquivos dentro de `{auth.uid()}/...`.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatares são publicamente legíveis"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "usuário sobe seu próprio avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "usuário atualiza seu próprio avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "usuário exclui seu próprio avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
