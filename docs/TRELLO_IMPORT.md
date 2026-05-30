# Trello Import

Fase: `INTEGRATIONS-AGENTS-TASKS-IMPORT-1`.

O menu Serviços possui o botão `Importar serviços`, voltado para planilhas `.xlsx` ou `.csv` exportadas do Trello.

## Fluxo

1. Usuário escolhe arquivo.
2. Backend lê a planilha.
3. Dry-run mostra estatísticas e prévia.
4. Usuário confirma.
5. Serviços são criados em `service_cards` com `organization_id` atual.

## Colunas principais

- `Card ID`: usado em `import_external_id` para evitar duplicidade.
- `Card Name`: título inicial do serviço.
- `Card Description`: observações.
- `Labels`: prioridade/tags.
- `List Name`: mapeamento para coluna do Kanban.
- `Due Date`: data prevista.
- `Start Date`: data inicial.
- `Card URL`: referência externa.

Duplicados por `Card ID` são pulados nesta fase.

Não importa anexos, comentários nem checklists do Trello ainda.

