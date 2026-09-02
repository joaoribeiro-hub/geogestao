# Documentos e avisos universais

## Documentos

Documentos privados continuam nas estruturas da organizacao. A tabela `universal_documents` guarda apenas conteudo global publicado pela plataforma, nas categorias `legislacao` e `anexos`.

Arquivos ficam no bucket privado `attachments`:

```text
global/universal-documents/{category}/{document_id}/{safe_filename}
```

O navegador autenticado envia o arquivo somente depois de passar pela policy de Storage. A API valida ID, categoria, MIME, limite de 50 MB e o caminho exato antes de gravar metadados. Downloads usam URL assinada por 5 minutos.

- usuario autenticado: le e baixa documento ativo;
- owner da empresa: possui a mesma permissao global de leitura;
- platform developer: publica e remove.

As paginas Legislação e Anexos mantem suas listas empresariais e exibem uma secao separada de documentos universais.

## Avisos

`universal_announcements` guarda um anuncio uma unica vez. Nao existe fanout por usuario. A API do sino combina os avisos ativos com `universal_announcement_reads`, que registra somente a leitura individual.

Assim, um usuario criado depois da publicacao ve o aviso enquanto ele estiver ativo. Marcar como lido nao afeta outros usuarios.

Anexos opcionais usam:

```text
global/universal-announcements/{announcement_id}/{safe_filename}
```

Somente o platform developer ve o botao `Criar notificacao universal`. Todos os usuarios autenticados veem o selo `Aviso da plataforma`, podem baixar o anexo por URL assinada e marcar a propria leitura.

## Teste manual

1. Como platform developer, publique um PDF em Legislação e um arquivo em Anexos.
2. Entre como membro de outra organizacao e confirme apenas leitura/download.
3. Como platform developer, publique um aviso com anexo no sino.
4. Entre como membro, marque o aviso como lido e confirme que outro membro ainda o ve como nao lido.
5. Crie um usuario depois e confirme que o aviso ativo e os documentos ativos aparecem.
6. Tente `POST` nas APIs universais como owner comum: deve retornar `403` e o RLS tambem deve negar insert direto.

