import { describe, expect, it } from "vitest";
import {
  companyKnowledgeChecklistItemSchema,
  hrAbsenceSchema,
  hrBirthdaySchema,
  hrDocumentSchema,
  teamMemberSchema,
} from "@/lib/schemas";

describe("HOME-HR-REPORTS-NOTIFICATIONS-FINISH-1 schemas", () => {
  it("accepts team member birth date without breaking monthly amount", () => {
    const parsed = teamMemberSchema.parse({
      name: "Natalia Silva",
      email: "natalia@example.com",
      monthly_amount: "R$ 2.500,00",
      role_title: "Analista",
      birth_date: "1995-05-21",
      status: "active",
    });

    expect(parsed.birth_date).toBe("1995-05-21");
    expect(parsed.monthly_amount).toBe(2500);
  });

  it("requires real storage metadata for HR documents", () => {
    const parsed = hrDocumentSchema.parse({
      title: "Contrato de prestacao",
      document_type: "Contrato",
      document_date: "2026-05-21",
      due_date: "",
      status: "active",
      storage_path: "organizations/org-1/hr/documents/contrato.pdf",
      file_name: "contrato.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
    });

    expect(parsed.title).toBe("Contrato de prestacao");
    expect(parsed.due_date).toBeNull();
    expect(parsed.size_bytes).toBe(1024);
  });

  it("validates absence and birthday calendar inputs", () => {
    expect(
      hrAbsenceSchema.parse({
        team_member_id: "00000000-0000-4000-8000-000000000001",
        absence_type: "ferias",
        start_date: "2026-06-01",
        end_date: "2026-06-10",
        notes: "Ferias programadas",
      }).absence_type,
    ).toBe("ferias");

    expect(
      hrBirthdaySchema.parse({
        name: "Aniversario da equipe",
        birthday: "2026-05-21",
        notes: "",
      }).team_member_id,
    ).toBeNull();
  });

  it("accepts company knowledge checklist item with optional scheduling", () => {
    const parsed = companyKnowledgeChecklistItemSchema.parse({
      knowledge_item_id: "00000000-0000-4000-8000-000000000002",
      title: "Revisar rotina do diretor de projetos",
      due_date: "2026-05-26",
      due_time: "14:00",
    });

    expect(parsed.title).toContain("diretor");
    expect(parsed.due_time).toBe("14:00");
  });
});
