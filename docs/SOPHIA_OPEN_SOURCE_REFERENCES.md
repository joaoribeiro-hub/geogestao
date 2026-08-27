# Referencias tecnicas da Sophia

As referencias abaixo orientam a arquitetura, mas nao sao dependencias obrigatorias do app:

- LangGraph: estado e execucao duravel por grafo;
- Letta/MemGPT, Mem0 e LangMem: memoria stateful e semantica;
- Reflexion: reflexoes apos feedback ou falha;
- Self-RAG: buscar evidencia, medir relevancia e recusar resposta sem suporte;
- Voyager: biblioteca de habilidades;
- Docling, OCRmyPDF, Tesseract, PyMuPDF e python-docx: extracao documental;
- pgvector: busca semantica futura;
- Qwen3/Qwen-Agent, Ollama, vLLM, Llama, Gemma e Mistral: providers locais futuros.

## Referencias ampliadas na Sophia 4

- Qwen-Agent e Qwen3: function calling e providers futuros;
- AgentScope e MS-Agent: orquestracao, skills e robustez;
- MetaGPT e ChatDev: SOPs, papeis e workflows;
- XAgent: despacho e execucao segura;
- LangChain-Chatchat, QAnything e RAGFlow: documentos, recuperacao e citacoes;
- Dify, FastGPT e MaxKB: observabilidade e paineis de workflow;
- Reflexion, ReAct e Self-RAG: acao, verificacao, correcao e resposta sustentada.

Esses projetos sao referencias arquiteturais. Nenhum codigo ou produto externo foi copiado ou instalado dentro do GeoGestao.

Nesta fase, o worker usa PyMuPDF, python-docx, Pillow e Tesseract quando instalados. A busca usa Postgres FTS com fallback textual. Nenhum modelo open-source local e instalado automaticamente e pgvector nao e exigido.
