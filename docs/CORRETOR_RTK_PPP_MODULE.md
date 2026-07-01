# Corretor de Coordenadas RTK/PPP

Este documento espelha `docs/RTK_PPP_MODULE.md`.

Status: funcional beta em `/modulos/corretor-rtk-ppp`.

O modulo corrige pontos rover somando o delta entre `BASE CORRIGIDA PPP/IBGE` e `BASE LEVANTADA`. A implementacao web porta a logica leve do ZIP local para TypeScript/Next e salva jobs por `organization_id` quando a migration `046_module_hub_real_port.sql` esta aplicada.
