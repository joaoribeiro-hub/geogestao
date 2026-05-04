# GeoGestao - Decisoes do Projeto

Data do checkpoint: 2026-04-30

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

8. O sistema deve futuramente ter mapa com upload KML/KMZ.

9. O mapa futuro deve permitir vincular perimetros a cliente, imovel e servico.

10. Supabase Auth, Supabase Database e Supabase Storage permanecem como base tecnica do projeto.

11. Chaves secretas nao devem ser expostas no frontend.

12. `service_role key` nao deve ser usada no frontend.

13. `.env.local` nao deve ser commitado.

14. O projeto nao deve ser recriado do zero. Evolucoes devem respeitar a base existente.

15. Funcionalidades futuras nao devem aparecer como se estivessem prontas. Botoes ainda nao funcionais devem ficar ocultos ou claramente marcados como "em breve".

16. O README deve acompanhar mudancas importantes de instalacao, ambiente, migrations e fluxos operacionais.

17. O fluxo de conversao de proposta deve ser idempotente: clique duplo nao pode duplicar contrato, servico ou receita.

18. A Fase 1 prioriza contrato, conversao proposta -> servico e receita automatica. Minha Empresa, Propostas v2, documentos por imovel, dashboard avancado e mapa ficam para fases posteriores.
