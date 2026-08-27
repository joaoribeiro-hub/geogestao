"use client";

import { useEffect, useState } from "react";
import { Command, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const commands = [
  { label: "Criar serviço", hint: "Abrir novo serviço", href: "/servicos?new=1" },
  { label: "Criar cliente", hint: "Abrir clientes", href: "/clientes?new=1" },
  { label: "Criar tarefa", hint: "Abrir tarefa", href: "/rotina?new=1" },
  { label: "Abrir Sophia", hint: "Assistente operacional", href: "/sophia" },
  { label: "Buscar serviço", hint: "Pesquisar no Kanban", href: "/servicos" },
  { label: "Buscar cliente", hint: "Pesquisar clientes", href: "/clientes" },
  { label: "Buscar ferramenta", hint: "Pesquisar ferramentas", href: "/ferramentas" },
];

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const normalized = query.trim().toLowerCase();
  const filtered = commands.filter((item) => !normalized || `${item.label} ${item.hint}`.toLowerCase().includes(normalized));

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="hidden gap-2 md:inline-flex" onClick={() => setOpen(true)} aria-label="Abrir menu de comandos">
        <Command className="size-4" aria-hidden="true" />
        <span>Comandos</span>
        <kbd className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">Ctrl K</kbd>
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[100] grid place-items-start bg-foreground/30 p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Menu de comandos" onMouseDown={() => setOpen(false)}>
          <section className="mx-auto w-full max-w-xl overflow-hidden rounded-lg border bg-card shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <header className="flex items-center gap-2 border-b p-3">
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
              <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar comando..." className="border-0 shadow-none focus-visible:ring-0" />
              <Button type="button" variant="ghost" size="icon" aria-label="Fechar menu de comandos" onClick={() => setOpen(false)}><X className="size-4" aria-hidden="true" /></Button>
            </header>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {filtered.length ? filtered.map((item) => (
                <button key={item.label} type="button" className="flex min-h-12 w-full items-center justify-between rounded-md px-3 text-left hover:bg-secondary focus-visible:bg-secondary" onClick={() => { setOpen(false); router.push(item.href); }}>
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.hint}</span>
                </button>
              )) : <p className="p-4 text-sm text-muted-foreground">Nenhum comando encontrado.</p>}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
