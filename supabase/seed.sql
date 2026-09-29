-- Categorias padrão (user_id null = molde usado pela migration 0004 para dar
-- uma cópia editável a cada usuário; deixam de aparecer diretamente no app
-- depois da 0004).
-- Rode depois da migration 0001, também no SQL Editor.

insert into categories (name, icon, type) values
  ('Salário', 'wallet', 'receita'),
  ('Freelance', 'briefcase', 'receita'),
  ('Outros recebimentos', 'plus-circle', 'receita'),
  ('Mercado', 'shopping-cart', 'despesa'),
  ('Moradia', 'home', 'despesa'),
  ('Transporte', 'car', 'despesa'),
  ('Restaurante', 'tools-kitchen-2', 'despesa'),
  ('Saúde', 'heart', 'despesa'),
  ('Lazer', 'device-gamepad-2', 'despesa'),
  ('Assinaturas', 'refresh', 'despesa'),
  ('Educação', 'book', 'despesa'),
  ('Outros gastos', 'dots-circle-horizontal', 'despesa');
