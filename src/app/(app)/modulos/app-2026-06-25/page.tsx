import { ModuleMigrationPage } from "@/components/modules/module-migration-page";

export default function App20260625ModulePage() {
  return (
    <ModuleMigrationPage
      title="App 2026-06-25"
      sourcePath="C:\\Users\\srlan\\Documents\\Codex\\2026-06-25\\quero-criar-um-app-local-para\\outputs\\Gerador_RW5_Local"
      stack="Python FastAPI local com templates Jinja2 e pyproj"
      summary="Modulo em migracao. O app encontrado e o Gerador RW5 Local, usado para converter TXT topografico em arquivo RW5."
      items={[
        "O app atual e offline/local, sem Supabase e sem login.",
        "Ele le arquivo TXT, normaliza conteudo e salva RW5/TXT em data/jobs/{jobId}.",
        "Migracao online deve substituir arquivos locais por metadados no banco e Storage por organization_id.",
        "A funcao principal pode virar modulo web apos isolamento de job, upload e download seguro.",
      ]}
    />
  );
}
