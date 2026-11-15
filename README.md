# Meu Dinheiro em Dia

Crie um sistema web de FINANÇAS PESSOAIS em português do Brasil (moeda R$, datas dd/mm/aaaa), responsivo e com visual limpo e moderno (mobile-first, pois será usado no celular). Ele substitui uma planilha de Excel que uso hoje. Use login por e-mail/senha (Lovable Cloud) e RLS para que cada usuário veja só os próprios dados.

## 1. Modelo de dados
**transactions** (lançamentos): id, user_id, tipo (entrada | saida), descricao, categoria_id, valor, data_vencimento, pago (bool), data_pagamento (nullable), forma_pagamento (Conta, Nubank Pessoal, Nubank Empresa, Dinheiro/Pix), recorrencia (unica | fixa | parcelada), parcela_atual, parcelas_total, grupo_id (liga todas as parcelas/meses de uma mesma conta), ciclo (1 ou 2), observacoes, created_at.
**categories**: id, user_id, nome, cor, icone, orcamento_mensal (nullable). Categorias iniciais: Moradia, Família/Sofia, Educação, Saúde, Transporte, Impostos/MEI, Assinaturas, Mercado, Lazer, Pets, Financiamentos/Parcelados, Cartão de crédito, Reserva/Poupança, Outros.
**settings**: user_id, orcamento_mercado (padrão 1200), lazer_por_ciclo (padrão 500), dia_corte_ciclo (padrão 24: vencimentos até o dia 23 pertencem ao Ciclo 1, do dia 24 em diante ao Ciclo 2).
**incomes_template** (ou lançamentos de entrada recorrentes): entradas fixas por ciclo.

## 2. Lógica dos ciclos (igual à minha planilha)
Recebo duas vezes por mês: **dia 08 (Ciclo 1)** e **dia 22 (Ciclo 2)**, R$ 8.067,00 cada. Também tenho "Bonificações" de R$ 1.000,00 por ciclo (tratar como entrada separada, não entra no líquido).
Para cada ciclo calcule:
- Total de contas do ciclo = soma das saídas cujo vencimento cai no ciclo
- Líquido = entrada do ciclo − total de contas
- Lazer do ciclo (padrão R$ 500)
- Restou para guardar = Líquido − Lazer
- Guardar parcial do mês = soma dos "restou" dos 2 ciclos; Total a guardar = guardar parcial + bonificações
Mostre isso em cartões lado a lado (Ciclo 1 e Ciclo 2) na tela do mês.

## 3. Telas
1. **Dashboard do mês** (seletor de mês com setas ‹ ›): entradas, saídas, saldo, quanto já foi pago x pendente, resumo dos 2 ciclos (item 2), gráfico de pizza de gastos por categoria, gráfico de barras dos últimos 6 meses (entradas x saídas), próximos vencimentos e contas atrasadas em destaque.
2. **Lançamentos do mês**: lista agrupada por data de vencimento (como na planilha: "Dia 8, Dia 10, Dia 13..."), com filtros por categoria, forma de pagamento, status (pago/pendente) e busca. Cada linha mostra descrição, categoria (badge colorida), valor, parcela (ex.: "9/10" ou "Fixo") e um checkbox para marcar como pago (ao marcar, preenche data_pagamento com hoje, editável). Botão "+" para novo lançamento.
3. **Novo/editar lançamento**: tipo, descrição, categoria, valor, vencimento, forma de pagamento, recorrência. Se "Fixa": gera o lançamento automaticamente para todos os meses seguintes (próximos 12, e continua gerando). Se "Parcelada": informe o número de parcelas e quantas já foram pagas; gera uma linha por mês com "parcela_atual/total" até o fim (ex.: FIES com 91 parcelas restantes). Ao editar, perguntar se vale só para este mês ou para este e os próximos.
4. **Mercado (envelope mensal)** — tela especial: orçamento mensal padrão R$ 1.200,00. Eu vou lançando as compras do mercado ao longo do mês (data, descrição opcional, valor). Mostre barra de progresso com gasto acumulado, **valor disponível para uso (orçamento − gasto)** e, se passar do orçamento, a barra fica vermelha e aparece um alerta "Estourou R$ X,XX". Alerta amarelo ao passar de 80%. Histórico mês a mês do mercado (barras com linha do orçamento) para eu ver em quais meses estourei. Compras do mercado são lançamentos da categoria Mercado, então também entram nos totais gerais; na visão de contas do ciclo, o mercado aparece como uma única linha "Mercado Mensal" com o total do mês (ou o orçamento, se ainda estiver abaixo dele).
5. **Faturas de cartão**: visão por cartão (Nubank Pessoal e Nubank Empresa) e por mês, listando as compras e parcelas (ex.: "Desumidificador 2/3") e o total da fatura (fechamento dia 26 deixe configurável).
6. **Categorias**: CRUD de categorias, cor e orçamento mensal opcional por categoria (mostrar % usado no dashboard).
7. **Importar / Exportar**: importar CSV/XLSX (colunas: vencimento, descricao, valor, parcelas) e exportar CSV do mês.

## 4. Dados iniciais (seed) — copie da minha planilha, mês de Outubro/2026
Entradas: Salário Ciclo 1 (dia 08) R$ 8.067,00; Salário Ciclo 2 (dia 22) R$ 8.067,00; Bonificação R$ 1.000,00 em cada ciclo.
Saídas (descrição | dia | valor | parcelas restantes ou Fixo):
- Planejados Apto Mãe | 8 | 1041,67 | 10
- Futebol AABB | 8 | 50 | Fixo
- Futebol Baumer | 8 | 35 | Fixo
- Mãe Lúcia | 8 | 150 | Fixo
- Corte Cabelo | 8 | 35 | Fixo
- Recanto | 8 | 249 | Fixo
- Aluguel AP | 8 | 1496,37 | Fixo
- Geladeira Mãe | 10 | 54,56 | 20
- Máquina de Lavar Mãe | 10 | 58,36 | 21
- Sofá Mãe | 10 | 113,91 | 12
- Claro Fibra 500MB | 10 | 170,90 | Fixo
- Escola Sofia (Imaculada) | 10 | 907,255 | 4
- Ballet Sofia (Imaculada) | 10 | 75 | 4
- Condomínio AP | 10 | 162,02 | Fixo
- Luz | 13 | 350,23 | Fixo
- AP Mãe/Pai/Rafa | 15 | 866,72 | Fixo
- Unimed Felipe | 15 | 529,90 | Fixo
- DAS - MEI (Felipe) | 20 | 86,05 | Fixo
- DAS - MEI (Jéssica) | 20 | 86,05 | Fixo
- Plano Vivo Controle - Felipe | 20 | 82 | Fixo
- FIES - Felipe | 24 | 478,31 | 91
- Apple Backup | 24 | 19,90 | Fixo
- Água | 24 | 120,22 | Fixo
- Reserva Sofia | 24 | 250 | Fixo
- Aniver Sofia | 24 | 250 | Fixo
- Ração/Remédio Cachorros | 24 | 320 | Fixo
- IPVA 2026 Polo / Fit | 25 | 343,08 | 3
- Polo 2020 - 200TSI Highline | 25 | 956,13 | 16
- Pedra (MogiGran) | 25 | 175 | 7
- Perfume Felipe (Sair) | 25 | 56 | 3
- Lençol | 25 | 75 | 4
- Cartão (compras parceladas, dia 26): Desumidificador 350 (3 restantes), Aparador 33,08 (2), Casa Zaniboni 53,24 (3), Buckman Modas Outlet 197,99 (2), Bolsa Jessica 176,65 (3), Bagaggio - Mochila Felipe 89,97 (3), Tenis Sofia 49,625 (3), Japonesa Kids 61,125 (2), Seguro Polo 312,58 (11), Bateria Polo 53 (3)
- Assinaturas fixas dia 26: Lovable 27,50; Supercoffe 96,43; Netflix 25; Prudential 253,92
- Mercado Mensal | 26 | orçamento 1200 (veja o mercado de Setembro abaixo)
Em Novembro/2026 o sistema deve projetar automaticamente as mesmas contas com as parcelas restantes diminuídas em 1 (as que chegaram a 0 somem), mais os novos itens que eu cadastrar.

## 5. Histórico do Mercado de Setembro/2026 (estourou o orçamento)
Cadastre estas 21 compras na categoria Mercado, mês 09/2026 (a data exata não está na planilha: use 26/09/2026 como data provisória e deixe fácil de editar): 85,86; 167,66; 386,89; 138,71; 126,80 (descrição "1/2 produtos limpeza"); 53,00 (descrição "mac balão"); 125,68; 72,86; 15,00; 40,86; 15,00; 15,00; 62,15; 79,77; 20,93; 42,29; 100,35; 15,00; 25,00; 61,99; 30,00.
Total = R$ 1.680,80, ou seja, **R$ 480,80 acima do orçamento de R$ 1.200,00**. Esse mês deve aparecer em vermelho no histórico do mercado como exemplo do alerta.

## 6. Detalhes de UX
- Valores formatados como R$ 1.234,56; verde para entradas, vermelho para saídas.
- Contas vencidas e não pagas ficam destacadas.
- Navegação inferior no mobile (Dashboard, Lançamentos, Mercado, Cartões, Mais).
- Estados vazios amigáveis e confirmação antes de excluir.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/167a43f6-b192-4463-bd0d-17f55d069cc6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
