# UX Clean Forms

Fase: UX-CLEAN-COMPANY-KNOWLEDGE-1.

Regra geral:

- cadastros pontuais usam botao + modal;
- informacoes principais que precisam ser consultadas permanecem na pagina;
- Minha Empresa > Informacoes abre em modo visualizacao e usa Editar/Salvar;
- modais preservam as mesmas actions server-side, RLS e validacoes existentes.

Formularios convertidos nesta fase:

- Documentos profissionais: `+ Anexar documento`;
- RH > Contratos e documentos: `+ Anexar documento`;
- Rotina: `+ Adicionar item de rotina`;
- Base Interna: `+ Novo eixo`, `+ Nova pagina`, edicao de pagina, blocos e checklist por modal.

Navegacao padrao:

- login bem-sucedido redireciona para `/inicio`;
- a raiz autenticada `/` redireciona para `/inicio`;
- deep links especificos continuam funcionando;
- usuarios sem organizacao continuam indo para `/onboarding`.

Proximos ajustes possiveis:

- converter outros formularios menores em modais quando a tela ficar poluida;
- criar um componente de modal com controle de foco mais completo;
- confirmar descarte de dados ao fechar modal com campos preenchidos.
