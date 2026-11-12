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

## Metas Rush e Elite (migração 02)
O SQL `operacao/02-metas.sql` é legado da tentativa de monitoramento detalhado e **não deve ser executado** para o fluxo atual; use somente `03-membros-fechamento.sql`. Apenas cria `cuba2_metas` e sua auditoria. Não altera registros antigos. A nova aba **Metas** estará no GitHub Pages após o deploy.

- Membro: cargo inicial, sem metas definidas.
- Rush: escolha semanal entre `4 bunkers + 200.000`, `2 bunkers + 2 lixos + 200.000` ou `4 lixos + 200.000`; o acompanhamento soma progresso por integrante e semana (segunda a domingo).
- Elite: isento de farm; meta financeira semanal de `300.000`; objetivo diário de 3 ações, das quais pelo menos 2 para a família e a terceira pode ser para integrantes. Os lançamentos de ações da Elite são informados manualmente pela gerência. Um dia sem lançamento não é comprovante de meta cumprida.
- Todos os seis gerentes podem lançar e visualizar as metas, sem login para membros.
- Relatórios de metas por data exportáveis como CSV, com auditoria.
- Atenção: para Rush, use sempre a MESMA opção no decorrer da semana; opções divergentes são identificadas como pendentes. A identificação de integrantes é textual na fase inicial.

## Controle semanal simplificado (migração 03, versão atual)
**Execute o novo `operacao/03-membros-fechamento.sql` no SQL Editor do Supabase para ativar Integrantes e Metas.** Esta migração cria tabelas novas `cuba2_integrantes` e `cuba2_metas_semanais` com RLS e auditoria, sem afetar lavagem ou mercadinho. O SQL antigo `02-metas.sql` não é necessário para o novo fluxo de marcação.

- A gerência cadastra integrantes com cargo Membro, Rush ou Elite, altera cargo e **desativa/reativa** sem precisar de suporte. Desativação não exclui histórico; para registrar saída, data de saída é preenchida e consultas históricas continuam mostrando o integrante no período em que participava.
- O Felipe continua administrando farm, detalhes de bunkers/lixos e anexos/screenshots no sistema dele. **Não há upload duplicado aqui.**
- Metas aqui são **apenas status de pagamento** de farm e dinheiro: Pago, Devendo, Isento ou Não conferido. A ausência de conferência nunca conta automaticamente como dívida.
- Rush: farm e dinheiro ($200.000), conferência separada. Elite: farm isento, dinheiro ($300.000) e ações monitoradas na aba Ações; Membro: ambos isentos até definição.
- **Calendário confirmado:** semana de segunda a domingo, pagamento na segunda-feira seguinte. Identificação por `semana_inicio`, a segunda-feira da semana (inclusive nas semanas que cruzam meses). O calendário mostra o intervalo e a data de vencimento. Para novembro/2026, a primeira semana do novo ciclo é 09/11–15/11, com vencimento 16/11; a operação inicia registros em 12/11.
- Na aba Metas, escolha mês/semana para ver nomes e categorias; na aba Relatórios, escolha Metas para CSV/PDF da semana selecionada.
- Integrantes não têm login. Todos os seis gerentes têm acesso integral. O login de Felipe e Jamal depende de passaportes/contas ainda não configuradas.

**Atenção:** Se uma versão anterior de `03-membros-fechamento.sql` já foi executada, NÃO reexecute a nova definição `CREATE TABLE IF NOT EXISTS` esperando que ela altere colunas. Será necessária uma migração da estrutura antiga, preservando registros. Confirme antes de rodar.
