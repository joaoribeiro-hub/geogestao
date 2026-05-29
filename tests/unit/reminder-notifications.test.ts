import { describe, expect, it } from "vitest";
import {
  buildReminderMessage,
  buildReminderNotificationDrafts,
  localDateKey,
  sanitizeInternalActionUrl,
  splitLocalDateTime,
} from "@/lib/notifications/reminders";

describe("reminder notification rules", () => {
  it("gera notificacao de lembrete para hoje", () => {
    const now = new Date("2026-05-21T15:00:00.000Z");
    const today = localDateKey(now);
    const drafts = buildReminderNotificationDrafts({
      reminderId: "reminder-1",
      entityType: "client_interaction",
      entityId: "interaction-1",
      title: "Ligar para cliente",
      reminderDate: today,
      reminderTime: null,
      now,
    });

    expect(drafts.map((draft) => draft.type)).toContain("reminder_due_today");
  });

  it("prepara janelas de 2h, 1h e horario exato para lembrete com horario", () => {
    const now = new Date("2026-05-21T17:30:00.000Z");
    const today = localDateKey(now);
    const drafts = buildReminderNotificationDrafts({
      reminderId: "reminder-1",
      entityType: "service_card",
      entityId: "service-1",
      title: "Revisar documento",
      reminderDate: today,
      reminderTime: "15:00",
      now,
    });

    expect(drafts.map((draft) => draft.type)).toEqual([
      "reminder_due_today",
      "reminder_two_hours_before",
      "reminder_one_hour_before",
      "reminder_due_now",
    ]);
  });

  it("nao exibe hoje para lembrete futuro antes do dia", () => {
    const drafts = buildReminderNotificationDrafts({
      reminderId: "reminder-1",
      entityType: "agenda_reminder",
      entityId: "reminder-1",
      title: "Reuniao",
      reminderDate: "2026-05-25",
      reminderTime: null,
      now: new Date("2026-05-21T15:00:00.000Z"),
    });

    expect(drafts).toHaveLength(0);
  });

  it("separa datetime-local em data e horario preservados", () => {
    expect(splitLocalDateTime("2026-05-21T14:35")).toEqual({
      date: "2026-05-21",
      time: "14:35",
    });
  });

  it("monta mensagem sem repetir o titulo do lembrete", () => {
    expect(buildReminderMessage("Lembrete para hoje", "Cliente Almeida: Retornar ligacao", "18:32")).toBe(
      "Cliente Almeida: Retornar ligacao. Horario: 18:32.",
    );
  });

  it("aceita somente action_url interna", () => {
    expect(sanitizeInternalActionUrl("/clientes/cliente-1")).toBe("/clientes/cliente-1");
    expect(sanitizeInternalActionUrl("https://example.com")).toBeNull();
    expect(sanitizeInternalActionUrl("//example.com")).toBeNull();
  });
});
