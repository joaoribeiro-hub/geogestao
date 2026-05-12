# GeoGestao - Decisoes do Projeto

Data do checkpoint: 2026-05-11

## Decisoes registradas

1. O GeoGestao e um sistema para escritorio de agrimensura.

2. O produto pode usar sistemas como Undesk apenas como referencia de UX. Nao deve copiar marca, logo, nomes protegidos, identidade visual ou layout identico.

3. O fluxo integrado principal deve ser:

   ```text
   Proposta -> Contrato -> Servico -> Financeiro
   ```

4. O modulo de propostas deve continuar usando uma experiencia de Kanban comercial.

5. O modulo de servicos tecnicos deve manter Kanban com cards arrastaveis.

6. O sistema deve ter uma area chamada "Minha Empresa" para centralizar configuracoes e cadastros internos.

7. A area "Minha Empresa" deve futuramente incluir:

   - Informacoes da empresa;
   - Equipe;
   - Clientes;
   - Variaveis financeiras;
   - Documentos internos;
   - Bancos;
   - Servicos e nichos;
   - Opcoes de propostas;
   - Opcoes de contratos;
   - Armazenamento.

8. O sistema tem uma area de mapa com upload KML/KMZ.

9. O mapa deve vincular perimetros a cliente, imovel e servico.

10. Supabase Auth, Supabase Database e Supabase Storage permanecem como base tecnica do projeto.

11. Chaves secretas nao devem ser expostas no frontend.

12. `service_role key` nao deve ser usada no frontend.

13. `.env.local` nao deve ser commitado.

14. O projeto nao deve ser recriado do zero. Evolucoes devem respeitar a base existente.

15. Funcionalidades futuras nao devem aparecer como se estivessem prontas. Botoes ainda nao funcionais devem ficar ocultos ou claramente marcados como "em breve".

16. O README deve acompanhar mudancas importantes de instalacao, ambiente, migrations e fluxos operacionais.

17. O fluxo de conversao de proposta deve ser idempotente: clique duplo nao pode duplicar contrato, servico ou receita.

18. A Fase 1 prioriza contrato, conversao proposta -> servico e receita automatica. Minha Empresa, Propostas v2, documentos por imovel, dashboard avancado e mapa ficam para fases posteriores.

19. A implementacao inicial do mapa deve usar Leaflet.

20. A camada inicial do mapa deve usar OpenStreetMap.

21. O mapa nao deve depender inicialmente de Google Earth.

22. A arquitetura do mapa deve ficar preparada para uma camada de satelite futura via provedor com API adequada.

23. KML/KMZ devem permanecer vinculados a cliente, imovel e servico/card tecnico.

24. O arquivo KML/KMZ original deve ser mantido no Storage privado quando possivel, e o GeoJSON derivado pode ser salvo no banco para renderizacao.

25. A Fase UX-2 pode usar sistemas de referencia apenas como inspiracao conceitual de fluxo, sem copiar identidade, nomes protegidos, layout ou codigo.

26. A UI principal de Propostas deve conduzir a conversao por status comercial. "Aprovado" cria/reaproveita contrato e servico; "Em espera" move para negociacao; "Nao aprovado" move para perdidas.

27. Proposta aprovada com pagamento "Nao pago" deve criar/reaproveitar receita pendente. Pagamento "Pago" deve criar/reaproveitar a mesma receita como paga, sem duplicidade.

28. PDF real em Storage permanece desejavel, mas preview A4 com imprimir/salvar como PDF e vinculo posterior via attachments e aceitavel como passo intermediario quando a geracao real for complexa.

29. Migrations antigas nao devem ser editadas para UX-2. Novos campos/tabelas devem entrar em migration aditiva e segura.

30. A base multiempresa deve usar um unico Supabase com isolamento por `organization_id`. Nao deve ser criado um projeto Supabase por cliente.

31. A Fase ACCOUNT-1 prepara planos e limites, mas nao implementa cobranca real, Stripe ou Mercado Pago.

32. `OPENAI_API_KEY` deve ser usada apenas no servidor. Nunca criar ou expor `NEXT_PUBLIC_OPENAI_API_KEY`.

33. O Chat IA inicial e somente leitura/geracao de texto. Ele nao altera banco nem executa acoes no produto nesta fase.

34. O limite de armazenamento por plano deve ser aplicado primeiro nos uploads novos mais seguros de controlar, com migracao progressiva para uploads especializados.

35. A aba `/mapa` evolui para "Fazer busca de imovel", mas a rota deve ser mantida por compatibilidade.

36. Bases CAR, INCRA/SIGEF, alertas e tematicas devem ser consultadas a partir do Supabase/Postgres, depois de importadas. Google Drive e apenas origem bruta dos arquivos.

37. O app nao deve consultar shapefile, DBF ou ZIP grande diretamente do Drive em cada busca por CAR.

38. PostGIS e a solucao preferida para intersecoes, buffers e indices espaciais. Quando nao estiver disponivel, `geom_geojson` fica como fallback, com limitacoes documentadas.

39. O GeoGestao nao deve automatizar login gov.br, capturar senha, guardar cookies, burlar captcha ou fazer scraping agressivo de portais oficiais.

40. Documentos oficiais que exigem login pessoal devem seguir fluxo assistido: abrir link oficial, baixar manualmente e anexar no sistema.
