import { ModuleMigrationPage } from "@/components/modules/module-migration-page";

export default function App20260529ModulePage() {
  return (
    <ModuleMigrationPage
      title="App 2026-05-29"
      sourcePath="C:\\Users\\srlan\\Documents\\Codex\\2026-05-29"
      stack="Nao auditado: pasta nao encontrada neste ambiente"
      summary="Modulo em migracao. A pasta informada nao existe neste computador, entao o modulo foi registrado como indisponivel ate o app real ser localizado."
      items={[
        "Nenhuma tabela, arquivo local ou tela principal foi assumida sem auditoria.",
        "Quando a pasta correta for encontrada, a migracao deve seguir o mesmo padrao por organization_id.",
        "A rota fica criada para documentar o status sem inventar funcionalidade.",
      ]}
    />
  );
}
