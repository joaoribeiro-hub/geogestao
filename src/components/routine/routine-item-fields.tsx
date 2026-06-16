"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RoutineMentionMember = {
  id: string;
  label: string;
};

export function RoutineItemFields({ members }: { members: RoutineMentionMember[] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activeField, setActiveField] = useState<"title" | "description" | null>(null);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);

  const activeValue = activeField === "title" ? title : activeField === "description" ? description : "";
  const mentionQuery = activeValue.match(/@([^\s@]*)$/)?.[1]?.toLowerCase() ?? null;
  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return members
      .filter((member) => member.label.toLowerCase().includes(mentionQuery))
      .slice(0, 8);
  }, [members, mentionQuery]);

  function insertMention(member: RoutineMentionMember) {
    const mention = `@${member.label}`;
    const apply = (value: string) => {
      if (/@([^\s@]*)$/.test(value)) return value.replace(/@([^\s@]*)$/, mention);
      return `${value.trim()} ${mention}`.trim();
    };
    if (activeField === "description") {
      setDescription((current) => apply(current));
    } else {
      setTitle((current) => apply(current));
      setActiveField("title");
    }
    setMentionedIds((current) => current.includes(member.id) ? current : [...current, member.id]);
  }

  return (
    <>
      <input type="hidden" name="mentioned_user_ids" value={JSON.stringify(mentionedIds)} />
      <div className="space-y-2">
        <Label>Tarefa</Label>
        <Input
          name="title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setActiveField("title");
          }}
          onFocus={() => setActiveField("title")}
          required
        />
        {activeField === "title" ? <MentionSuggestions suggestions={suggestions} onSelect={insertMention} /> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Escopo</Label>
          <select name="routine_scope" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="daily">Diaria</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
            <option value="annual">Anual</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input name="routine_date" type="date" defaultValue={toDateKey(new Date())} />
        </div>
        <div className="space-y-2">
          <Label>Horario</Label>
          <Input name="due_time" type="time" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Descricao</Label>
        <Textarea
          name="description"
          rows={3}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setActiveField("description");
          }}
          onFocus={() => setActiveField("description")}
        />
        {activeField === "description" ? <MentionSuggestions suggestions={suggestions} onSelect={insertMention} /> : null}
      </div>
    </>
  );
}

function MentionSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: RoutineMentionMember[];
  onSelect: (member: RoutineMentionMember) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="max-h-44 overflow-y-auto rounded-md border bg-card p-1 shadow-lg">
      {suggestions.map((member) => (
        <button
          key={member.id}
          type="button"
          className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
          onClick={() => onSelect(member)}
        >
          @{member.label}
        </button>
      ))}
    </div>
  );
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
