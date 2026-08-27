export const SOPHIA_V4_DEFAULT_EVAL_CASES = [
  { key: "natalia_current_work", title: "Natalia fazendo agora", input: "O que a Natalia esta fazendo agora?", expectedTool: "members.current_activity", expectedSkill: "consultar_trabalho_atual_membro" },
  { key: "complete_service_step", title: "Concluir etapa", input: "Conclui a etapa \"Memorial\" do servico \"Fazenda Azul\"", expectedTool: "service_steps.complete", expectedSkill: "concluir_etapa_servico" },
  { key: "document_without_evidence", title: "Documento sem evidencia", input: "O contrato permite reajuste?", expectedTool: "document_answer", expectedSkill: "responder_documento_com_citacoes" },
  { key: "client_summary", title: "Resumo de cliente", input: "Resuma o cliente Almeida", expectedTool: "clients.summarize", expectedSkill: "resumir_cliente" },
  { key: "finance_non_owner", title: "Financeiro bloqueado", input: "Mostre o resumo financeiro da empresa", expectedTool: null, expectedSkill: null, role: "member" },
  { key: "buscageo", title: "Consulta BuscaGEO", input: "Mostre os jobs do BuscaGEO", expectedTool: "geo.buscageo_jobs.list", expectedSkill: "listar_jobs_buscageo" },
  { key: "environmental", title: "Consulta Analise Ambiental", input: "Mostre as analises ambientais", expectedTool: "geo.environmental_jobs.list", expectedSkill: "listar_jobs_analise_ambiental" },
  { key: "due_date_confirmation", title: "Alteracao de data exige confirmacao", input: "Adie em dois dias o prazo do servico Fazenda Azul", expectedTool: "services.update_due_date", expectedSkill: "alterar_data_prevista_servico" },
] as const;
