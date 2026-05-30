import { AssistantChat } from "@/components/assistant/assistant-chat";
import { PageHeader } from "@/components/layout/page-header";

export default function AssistantPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sophia"
        description="Converse com a Sophia para consultar servicos, clientes, tarefas e registrar interacoes com seguranca."
      />
      <AssistantChat />
    </div>
  );
}
