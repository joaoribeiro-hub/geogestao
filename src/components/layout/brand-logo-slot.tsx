import Link from "next/link";

export function BrandLogoSlot({ logoUrl }: { logoUrl?: string | null }) {
  return (
    <Link href="/inicio" aria-label="Ir para Início" className="brand-logo-slot flex min-h-11 items-center rounded-md px-2 py-2 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {logoUrl ? <img src={logoUrl} alt="Logo da empresa" className="h-9 max-w-44 object-contain object-left" /> : (
        <span className="grid size-9 place-items-center rounded-md border border-dashed border-primary/40 bg-primary/5 text-xs font-bold text-primary" aria-hidden="true">GG</span>
      )}
    </Link>
  );
}
