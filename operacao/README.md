# CUBA • Nova Operação (desde 12/11/2026)

Implementação inicial **em branch separada**. Não houve publicação nem alteração no banco Supabase.

## Integridade do legado
A pasta `gerencial/` e suas tabelas antigas permanecem intactas. Registros de lavagem até 11/11/2026 são preservados. A nova área usa exclusivamente tabelas `cuba2_*` e datas a partir de 12/11/2026.

## Preparação
1. Faça backup do Supabase antes de qualquer migração.
2. No SQL Editor do **mesmo projeto já utilizado pelo gerencial**, execute `operacao/01-schema.sql` (revisar políticas previamente). Ele NÃO modifica as tabelas antigas.
3. Em Authentication > Users, mantenha/crie senhas individuais via conta `PASSAPORTE@cuba.local`, sem registrar senhas no GitHub.
4. Confirme os seis perfis em `public.profiles` com `access_level='gerencial'` e `active=true`:
   - Carol (01) — verificar se o cadastro antigo `Caroll` é a mesma pessoa; passaporte antigo 2423 (confirmar).
   - Caio (02) — passaporte antigo 2098 (confirmar).
   - Felipe (Gerente de Farm) — passaporte **não informado**.
   - Renan (Gerente Geral) — cadastro anterior Renan Desbrava / 3072 (confirmar).
   - Jamal (Gerente de Ação) — passaporte **não informado**.
   - Raissa (Gerente Geral) — cadastro anterior Raissa Fernandez / 7206 (confirmar).
5. Desative os perfis de antigos gerentes que não devam mais entrar, por exemplo Nickolay (revisar identidade previamente); somente desativar perfil, **não apagar dados históricos**.
6. Todos os seis têm as mesmas permissões completas via `cuba_access_ok()` e políticas RLS. Membros comuns sem perfis gerenciais não acessam.
7. Acesse `/operacao/` no site GitHub Pages após mesclar PR e publicar. A área importa o `../gerencial/config.js` e compartilha autenticação da gerência.

## Ações
- Modalidade **fuga** ou **tiro**.
- Resultado **sucesso**, **sucesso parcial**, **red/derrota**.
- Participantes e quantos tiveram êxito; sucesso parcial exige de 1 até N-1.
- Recompensa para família, integrantes ou divisão parcial. Em red o valor é zero.
- Valores registrados separadamente em moeda real/dólar e dinheiro limpo/sujo. Sem conversão fictícia.
- **Não há custos variáveis por ação** nem acompanhamento de perdas de armas.
- O valor destinado à família representa direito à receita, **não** entrada automática no caixa.

## Financeiro e relatórios
- Catálogo de produtos RP e vendas com valor líquido, desconto, recebido e status.
- Caixa com entradas, saídas e saldo inicial, separado por moeda.
- Relatórios filtrados por período: modalidade, sucesso/red/parcial, participantes bem-sucedidos, venda, caixa e distribuições.
- CSV e impressão/PDF do navegador.
- Auditoria RLS das tabelas novas.
- **Limitações da versão inicial:** ainda não há integração com o sistema de farm, custos/consumo de materiais, vínculo entre pagamento e venda, fechamento mensal imutável, exclusão/correção pela interface ou importação de saldo inicial automatizada. Esses itens devem ser feitos em versões posteriores.
- Segurança: site estático público mas registros protegidos por Supabase Auth e RLS; nunca expor service_role.
