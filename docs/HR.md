# RH

Fase: HOME-ROUTINE-SCHEDULE-FINANCE-COMPANY-1.

O antigo acesso visual de Equipe passa para Minha Empresa > RH > Colaboradores.

Seções preparadas:

- Colaboradores
- Contratos e documentos
- Ferias e faltas
- Aniversarios

Regras:

- a logica existente de colaboradores/equipe foi mantida;
- salario/valor mensal de colaborador continua criando despesa recorrente no Financeiro;
- documentos, ferias/faltas e aniversarios possuem tabelas preparadas para evolucao;
- dados sempre pertencem a organization_id;
- owner edita, admin operacional visualiza conforme regra de Minha Empresa.

## HOME-HR-REPORTS-NOTIFICATIONS-FINISH-1

RH foi finalizado para uso operacional inicial.

Colaboradores:

- cadastro/edicao ganhou Data de nascimento;
- aniversarios dos colaboradores aparecem automaticamente no calendario de RH;
- salario/valor mensal continua criando despesa recorrente no Financeiro.

Contratos e documentos:

- owner pode anexar documento real com nome, colaborador opcional, tipo, data, vencimento, status e arquivo;
- arquivos usam o bucket privado `attachments` dentro de `organizations/{organization_id}/hr/documents/...`;
- a lista mostra Visualizar, Baixar e Apagar;
- admin operacional apenas visualiza.

Na arquitetura profissional de documentos, o novo bucket privado `documentos` tambem aceita paths de RH em
`organizations/{organization_id}/hr/{employee_id}/documents/...`. A tela atual de RH continua compativel com `hr_documents`
e pode ser migrada gradualmente para `documents`.

Ferias e faltas:

- calendario mensal visual;
- registros aceitos: ferias, falta, afastamento e outro;
- periodo com inicio/fim aparece nos dias correspondentes;
- owner cria/apaga registros.

Aniversarios:

- calendario mensal visual;
- combina nascimento dos colaboradores e aniversarios manuais;
- aniversario manual pode ser criado e apagado pelo owner.

## WORK-TIME-TRACKING-1

RH > Colaboradores ganhou configuracao de jornada:

- tipo de escala: 5x2, 6x1 ou personalizada;
- minutos esperados por domingo a sabado;
- horario padrao de inicio/fim opcional.

Esses campos alimentam os relatorios de horas. Se o colaborador nao tiver jornada configurada ou nao estiver vinculado a um usuario (`auth_user_id`), os relatorios usam o padrao 5x2 com 8h de segunda a sexta.
