import { test } from 'node:test';
import { equal, deepStrictEqual, rejects, ok } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// PostgreSQL isolado em memória. Nunca usa credenciais nem dados do Supabase.
test('ciclo de vida no PostgreSQL: transação, RLS e preservação financeira', async t => {
  const db = new PGlite();
  const owner = '10000000-0000-0000-0000-000000000001';
  const other = '10000000-0000-0000-0000-000000000002';
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create role authenticated;
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${owner}'), ('${other}');`);
  for (const file of ['0001_init.sql', '0002_transfers.sql', '0010_credit_cards.sql', '0012_net_worth_snapshots.sql', '0015_monthly_reports.sql', '0022_card_invoice_month.sql', '0023_card_lifecycle.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
    set role authenticated; select set_config('request.jwt.claim.sub', '${owner}', false);`);
  const uuid = (n: number) => `20000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const card = async (n: number) => {
    await db.query('insert into accounts(id,user_id,name,type) values ($1,$2,$3,\'cartao\')', [uuid(n), owner, `Cartão ${n}`]);
    return uuid(n);
  };
  const action = async (id: string, mode: string, name: string | null = null, item: string | null = null, kind: string | null = null) => {
    const { rows } = await db.query<{ result: any }>('select card_lifecycle($1,$2,$3,$4,$5) as result', [id, mode, name, item, kind]);
    return rows[0].result;
  };
  try {
    await t.test('sem sessão ou outro titular não acessa nem altera', async () => {
      const id = await card(1);
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
      for (const mode of ['inspect', 'archive', 'restore', 'delete', 'pay']) await rejects(action(id, mode, 'Cartão 1'), /Cartão não encontrado/);
      await db.query("select set_config('request.jwt.claim.sub', '', false)");
      await rejects(action(id, 'delete', 'Cartão 1'), /Sessão expirada/);
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    });
    await t.test('vazio exige nome exato; delete direto e mudança de tipo não contornam', async () => {
      const id = await card(2);
      await rejects(action(id, 'delete', 'Errado'), /nome exato/);
      await db.query('delete from accounts where id = $1', [id]);
      equal((await db.query('select id from accounts where id=$1', [id])).rows.length, 1);
      await rejects(db.query("update accounts set type='corrente' where id=$1", [id]), /Arquive ou exclua/);
      const result = await action(id, 'delete', 'Cartão 2');
      equal(result.transactionCount, 0); equal(result.installmentCount, 0);
      equal((await db.query('select id from accounts where id=$1', [id])).rows.length, 0);
    });
    await t.test('compras e parcelas vencidas sem quitação bloqueiam; arquivar não apaga nada', async () => {
      const id = await card(3);
      await db.query(`insert into transactions(id,user_id,account_id,type,amount,occurred_at,invoice_month,card_due_date)
        values ($1,$2,$3,'despesa',40.01,'2020-01-02','2020-01','2020-01-20')`, [uuid(30), owner, id]);
      await db.query(`insert into installments(id,user_id,transaction_id,installment_number,total_installments,amount,due_date,invoice_month)
        values ($1,$2,$3,2,2,40.02,'2020-02-20','2020-02')`, [uuid(31), owner, uuid(30)]);
      const before = await action(id, 'inspect');
      equal(before.openItems.length, 2); equal(before.transactionCount, 1); equal(before.installmentCount, 1);
      await rejects(action(id, 'delete', 'Cartão 3'), /pendências/);
      await action(id, 'archive');
      deepStrictEqual(await action(id, 'inspect'), before);
      ok((await db.query<{archived_at: string}>('select archived_at from accounts where id=$1', [id])).rows[0].archived_at);
      await rejects(db.query("insert into transactions(user_id,account_id,type,amount) values ($1,$2,'despesa',5)", [owner,id]), /arquivada/);
      await rejects(db.query('insert into installments(user_id,transaction_id,installment_number,total_installments,amount,due_date) values ($1,$2,3,3,5,\'2027-01-01\')', [owner,uuid(30)]), /arquivado/);
      await db.query("update transactions set description='Histórico editado' where id=$1", [uuid(30)]);
      await rejects(action(id, 'delete', 'Cartão 3'), /pendências/);
      await action(id, 'restore');
      equal((await db.query<{archived_at: null}>('select archived_at from accounts where id=$1', [id])).rows[0].archived_at, null);
    });
    await t.test('quita individualmente; excluir preserva valores, parcelas, relatórios e snapshots', async () => {
      const id = uuid(3);
      await rejects(action(id, 'pay', null, uuid(1), 'transaction'), /Pendência não encontrada/);
      await action(id, 'pay', null, uuid(30), 'transaction');
      await rejects(action(id, 'delete', 'Cartão 3'), /pendências/);
      await action(id, 'pay', null, uuid(31), 'installment');
      const beforeTx = (await db.query('select amount,occurred_at,invoice_month,card_due_date from transactions where id=$1', [uuid(30)])).rows;
      const beforeParts = (await db.query('select * from installments where id=$1', [uuid(31)])).rows;
      await db.query("insert into net_worth_snapshots(user_id,month_date,assets,liabilities,net_worth) values ($1,'2020-01-01',100,20,80)", [owner]);
      await db.query("insert into monthly_reports(user_id,month_date,recebido,gasto,saldo) values ($1,'2020-01-01',100,40.01,59.99)", [owner]);
      const beforeSnapshots = (await db.query('select * from net_worth_snapshots')).rows;
      const beforeReports = (await db.query('select * from monthly_reports')).rows;
      const result = await action(id, 'delete', 'Cartão 3');
      equal(result.openItems.length, 0);
      const tx = (await db.query<{account_id: null; removed_card: boolean}>('select account_id,removed_card from transactions where id=$1',[uuid(30)])).rows[0];
      equal(tx.account_id, null); equal(tx.removed_card, true);
      deepStrictEqual((await db.query('select amount,occurred_at,invoice_month,card_due_date from transactions where id=$1', [uuid(30)])).rows, beforeTx);
      deepStrictEqual((await db.query('select * from installments where id=$1', [uuid(31)])).rows, beforeParts);
      deepStrictEqual((await db.query('select * from net_worth_snapshots')).rows, beforeSnapshots);
      deepStrictEqual((await db.query('select * from monthly_reports')).rows, beforeReports);
    });
    await t.test('transferência mantém a outra ponta e marca destino removido', async () => {
      const id = await card(4);
      await db.query("insert into accounts(id,user_id,name,type) values ($1,$2,'Banco','corrente')", [uuid(40),owner]);
      await db.query("insert into transactions(id,user_id,account_id,transfer_account_id,type,amount) values ($1,$2,$3,$4,'transferencia',80)", [uuid(41),owner,uuid(40),id]);
      await action(id, 'delete', 'Cartão 4');
      const row = (await db.query('select account_id,transfer_account_id,removed_transfer_card,amount from transactions where id=$1', [uuid(41)])).rows[0];
      deepStrictEqual(row, {account_id: uuid(40), transfer_account_id: null, removed_transfer_card: true, amount: '80.00'});
    });
    await t.test('falha no delete reverte também os marcadores dos lançamentos', async () => {
      const id = await card(6);
      await db.query("insert into transactions(id,user_id,account_id,type,amount,card_paid_at) values ($1,$2,$3,'despesa',12,now())", [uuid(60), owner, id]);
      await db.exec(`reset role;
        create function fail_test_delete() returns trigger language plpgsql as $$ begin
          if old.id = '${id}' then raise exception 'Falha simulada'; end if;
          return old;
        end $$;
        create trigger fail_test_delete before delete on accounts for each row execute function fail_test_delete();
        set role authenticated;`);
      await rejects(action(id, 'delete', 'Cartão 6'), /Falha simulada/);
      const row = (await db.query('select account_id,removed_card from transactions where id=$1', [uuid(60)])).rows[0];
      deepStrictEqual(row, {account_id: id, removed_card: false});
      equal((await db.query('select id from accounts where id=$1', [id])).rows.length, 1);
      await db.exec('reset role; drop trigger fail_test_delete on accounts; drop function fail_test_delete(); set role authenticated;');
    });
    await t.test('parcela futura e lançamento pendente também bloqueiam', async () => {
      const id = await card(7);
      await db.query("insert into transactions(id,user_id,account_id,type,amount,card_paid_at) values ($1,$2,$3,'despesa',10,now())", [uuid(70), owner, id]);
      await db.query("insert into installments(id,user_id,transaction_id,installment_number,total_installments,amount,due_date) values ($1,$2,$3,2,2,10,'2099-01-01')", [uuid(71),owner,uuid(70)]);
      await db.query("insert into transactions(id,user_id,transfer_account_id,type,amount,status) values ($1,$2,$3,'transferencia',10,'pendente')", [uuid(72), owner, id]);
      const open = (await action(id, 'inspect')).openItems;
      equal(open.length, 2);
      await rejects(action(id, 'delete', 'Cartão 7'), /pendências/);
      await action(id, 'pay', null, uuid(71), 'installment');
      await rejects(action(id, 'delete', 'Cartão 7'), /pendências/);
      await action(id, 'pay', null, uuid(72), 'pending');
      await action(id, 'delete', 'Cartão 7');
    });
    await t.test('nova compra entre prévia e confirmação impede exclusão', async () => {
      const id = await card(5);
      equal((await action(id, 'inspect')).openItems.length, 0);
      await db.query("insert into transactions(user_id,account_id,type,amount) values ($1,$2,'despesa',100)", [owner,id]);
      await rejects(action(id, 'delete', 'Cartão 5'), /pendências/);
      equal((await db.query('select id from accounts where id=$1', [id])).rows.length, 1);
    });
  } finally { await db.close(); }
});
