# Modulo Corretor RTK/PPP

Fase: `MODULE-HUB-REAL-PORT-1`.

## Origem Auditada

ZIP auditado:

`Corretor_RTK_PPP_Local.zip`

Arquivos reaproveitados conceitualmente:

- `app/parser.py`
- `app/correction.py`
- `app/exporter.py`
- `app/models.py`
- `app/ui.py`

## Rota

- `/modulos/corretor-rtk-ppp`

## Funcional

- Upload de TXT/CSV.
- Botao `Ler arquivo`.
- Deteccao de encoding e delimitador.
- Parser alinhado ao app original: `ID`, `descricao`, `NORTE`, `ESTE`, `ALTITUDE`.
- Identificacao de base por `base_`, `BASE` ou `B_`.
- Identificacao de rover por ID numerico.
- Blocos visuais: arquivo, base levantada, base corrigida PPP/IBGE, correcao base, configuracoes e resultado.
- Calculo de `DeltaN`, `DeltaE` e `DeltaH`.
- Aplicacao do delta nos pontos rover.
- Exportacao de TXT corrigido com delimitador configuravel.
- Registro de job em `module_rtk_ppp_jobs` quando as migrations estao aplicadas.
- Tentativa de upload do original e do resultado no bucket `documentos`.

## Storage

- `organizations/{organization_id}/modules/rtk-ppp/{job_id}/original.txt`
- `organizations/{organization_id}/modules/rtk-ppp/{job_id}/corrigido.txt`

## Seguranca

As rotas API exigem usuario autenticado e organizacao atual. A tabela tem RLS por `organization_id`.

## Como Testar

1. Abrir `/modulos/corretor-rtk-ppp`.
2. Enviar TXT com linha de base e pontos numericos.
3. Clicar em `Ler arquivo`.
4. Conferir formato, encoding, delimitador, base e pontos rover.
5. Informar base corrigida PPP/IBGE.
6. Clicar em `Calcular correcao`.
7. Baixar o TXT corrigido.
