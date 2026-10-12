-- Aplicar somente após autorização. Não presume quitação de dados antigos.
alter table accounts add column archived_at timestamptz;
alter table transactions add column removed_card boolean not null default false;
alter table transactions add column removed_transfer_card boolean not null default false;
alter table transactions add column card_paid_at timestamptz;
alter table installments add column paid_at timestamptz;
create index idx_accounts_user_active on accounts(user_id) where archived_at is null;
create index idx_transactions_account on transactions(account_id);
create index idx_transactions_transfer_account on transactions(transfer_account_id);
create index idx_transactions_unpaid_card on transactions(user_id, account_id, card_due_date)
  where type = 'despesa' and card_paid_at is null;
create index idx_installments_unpaid on installments(user_id, due_date) where paid_at is null;

-- Status da compra não é status da fatura. Todas as despesas sem confirmação
-- explícita de quitação são compromissos, inclusive vencidas e anteriores à 0022.
create function card_open_items(p_card_id uuid) returns table (
  id uuid, kind text, description text, amount numeric, due_date date,
  invoice_month text, installment_number int
) language sql stable security invoker set search_path = public as $$
  select t.id, 'transaction', coalesce(t.description, 'Compra no cartão'), t.amount,
    coalesce(t.card_due_date, t.due_date), t.invoice_month, 1
  from transactions t
  where (t.account_id = p_card_id or t.transfer_account_id = p_card_id) and t.type = 'despesa' and t.card_paid_at is null
  union all
  select t.id, 'pending', coalesce(t.description, 'Lançamento pendente'), t.amount,
    t.due_date, null, null
  from transactions t
  where (t.account_id = p_card_id or t.transfer_account_id = p_card_id)
    and t.type <> 'despesa' and t.status <> 'pago'
  union all
  select i.id, 'installment', coalesce(t.description, 'Parcela do cartão'), i.amount,
    i.due_date, i.invoice_month, i.installment_number
  from installments i join transactions t on t.id = i.transaction_id
  where (t.account_id = p_card_id or t.transfer_account_id = p_card_id) and i.paid_at is null;
$$;

create function card_lifecycle(p_card_id uuid, p_action text default 'inspect', p_name text default null,
  p_item_id uuid default null, p_kind text default null) returns jsonb
-- SECURITY DEFINER permite só a operação validada, apesar do bloqueio de delete
-- direto pela RLS. Titularidade é obrigatória e conferida dentro desta função.
language plpgsql security definer set search_path = public as $$
declare
  card accounts%rowtype;
  result jsonb;
  affected int;
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  -- Serializa arquivar/restaurar/excluir com inserts que referenciam a conta.
  select * into card from accounts where id = p_card_id and user_id = auth.uid() and type = 'cartao' for update;
  if not found then raise exception 'Cartão não encontrado.'; end if;
  if p_action not in ('inspect', 'archive', 'restore', 'delete', 'pay') then raise exception 'Ação inválida.'; end if;
  -- FOR UPDATE também bloqueia novos filhos por FK durante a exclusão.
  perform 1 from transactions where account_id = card.id or transfer_account_id = card.id order by id for update;
  perform 1 from installments where transaction_id in (
    select id from transactions where account_id = card.id or transfer_account_id = card.id
  ) order by id for update;

  if exists (select 1 from transactions where (account_id = card.id or transfer_account_id = card.id) and user_id <> auth.uid())
    or exists (select 1 from installments i join transactions t on t.id = i.transaction_id
      where (t.account_id = card.id or t.transfer_account_id = card.id) and i.user_id <> auth.uid()) then
    raise exception 'Vínculo com titular divergente. Operação bloqueada.';
  end if;

  if p_action = 'pay' then
    if not exists (select 1 from card_open_items(card.id) where id = p_item_id and kind = p_kind) then
      raise exception 'Pendência não encontrada neste cartão.';
    end if;
    if p_kind = 'installment' then
      update installments set paid_at = now() where id = p_item_id and user_id = auth.uid();
    elsif p_kind = 'transaction' then
      update transactions set card_paid_at = now(), status = 'pago' where id = p_item_id and user_id = auth.uid();
    elsif p_kind = 'pending' then
      update transactions set status = 'pago' where id = p_item_id and user_id = auth.uid();
    end if;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Não foi possível confirmar a quitação.'; end if;
  end if;

  select jsonb_build_object(
    'transactionCount', (select count(*) from transactions where account_id = card.id or transfer_account_id = card.id),
    'installmentCount', (select count(*) from installments where transaction_id in (select id from transactions where account_id = card.id or transfer_account_id = card.id)),
    'openItems', coalesce((select jsonb_agg(to_jsonb(o) order by o.due_date nulls first, o.id) from card_open_items(card.id) o), '[]'::jsonb)
  ) into result;

  if p_action = 'delete' then
    if p_name is distinct from card.name then raise exception 'Digite o nome exato do cartão para confirmar.'; end if;
    if jsonb_array_length(result->'openItems') > 0 then raise exception 'Este cartão tem pendências. Quite ou remova as parcelas, ou arquive o cartão.'; end if;
    -- Preserva valores, datas de compra, referências de fatura e parcelas.
    -- Só desfaz o vínculo com accounts, conforme as FKs ON DELETE SET NULL.
    update transactions set removed_card = true where account_id = card.id;
    update transactions set removed_transfer_card = true where transfer_account_id = card.id;
    delete from accounts where id = card.id and user_id = auth.uid();
  elsif p_action = 'archive' then
    update accounts set archived_at = coalesce(archived_at, now()) where id = card.id and user_id = auth.uid();
  elsif p_action = 'restore' then
    update accounts set archived_at = null where id = card.id and user_id = auth.uid();
  end if;
  return result;
end;
$$;
revoke all on function card_lifecycle(uuid,text,text,uuid,text) from public;
grant execute on function card_lifecycle(uuid,text,text,uuid,text) to authenticated;
revoke all on function card_open_items(uuid) from public;
grant execute on function card_open_items(uuid) to authenticated;

-- Defesa adicional: clientes antigos não podem excluir cartões diretamente.
-- A RLS proíbe delete direto de cartões; a RPC acima valida a operação.
drop policy "usuário exclui suas contas" on accounts;
create policy "usuário exclui contas comuns" on accounts for delete
  using (auth.uid() = user_id and type <> 'cartao');

create function guard_archived_card_binding() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if tg_op = 'INSERT' or new.account_id is distinct from old.account_id then
    target := new.account_id;
    if target is not null then
      perform 1 from accounts where id = target and archived_at is null and user_id = new.user_id for share;
      if not found then raise exception 'Conta indisponível ou arquivada.'; end if;
    end if;
  end if;
  if tg_op = 'INSERT' or new.transfer_account_id is distinct from old.transfer_account_id then
    target := new.transfer_account_id;
    if target is not null then
      perform 1 from accounts where id = target and archived_at is null and user_id = new.user_id for share;
      if not found then raise exception 'Conta de destino indisponível ou arquivada.'; end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_archived_card_binding before insert or update of account_id, transfer_account_id
  on transactions for each row execute function guard_archived_card_binding();

-- Não permite contornar a regra de exclusão convertendo o cartão em conta comum.
create function guard_card_type_change() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.type = 'cartao' and new.type <> 'cartao' then
    raise exception 'Arquive ou exclua o cartão pelas opções de gerenciamento.';
  end if;
  return new;
end;
$$;
create trigger guard_card_type_change before update of type on accounts
  for each row execute function guard_card_type_change();

create function guard_archived_card_installment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Serializa com o ciclo de vida e impede parcelas novas após arquivamento.
  perform 1 from transactions t join accounts a on a.id = t.account_id
    where t.id = new.transaction_id and t.user_id = new.user_id
      and a.user_id = new.user_id and a.archived_at is null and a.type = 'cartao'
    for share of a, t;
  if not found then raise exception 'Cartão indisponível ou arquivado para novas parcelas.'; end if;
  return new;
end;
$$;
create trigger guard_archived_card_installment before insert or update of transaction_id on installments
  for each row execute function guard_archived_card_installment();
