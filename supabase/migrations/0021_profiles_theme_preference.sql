-- Preferência de tema (claro/escuro/sistema) salva por usuário, pra
-- sincronizar entre dispositivos — localStorage cobre a resposta instantânea
-- no mesmo navegador, essa coluna é o que persiste entre eles.
alter table profiles
  add column if not exists theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system'));
