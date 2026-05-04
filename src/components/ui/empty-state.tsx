import { Inbox } from "lucide-react";

export function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed bg-background/70 p-6 text-center text-sm text-muted-foreground">
      <Inbox className="mb-2 size-5" aria-hidden="true" />
      {title}
    </div>
  );
}
