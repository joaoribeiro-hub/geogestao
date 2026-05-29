"use client";

import { useTransition } from "react";
import { toggleRoutineItemAction } from "@/app/(app)/rotina/actions";

export function RoutineItemToggle({
  itemId,
  checked,
  label,
}: {
  itemId: string;
  checked: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-background px-3 py-2 text-sm">
      <input
        className="mt-1"
        type="checkbox"
        defaultChecked={checked}
        disabled={pending}
        onChange={(event) =>
          startTransition(() => {
            void toggleRoutineItemAction(itemId, event.target.checked);
          })
        }
      />
      <span className={checked ? "text-muted-foreground line-through" : ""}>{label}</span>
    </label>
  );
}
