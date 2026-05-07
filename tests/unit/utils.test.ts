import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";

describe("utils", () => {
  it("converte numero pt-BR vindo de formulario", () => {
    expect(toNumber("1.234,56")).toBe(1234.56);
    expect(toNumber("texto")).toBeNull();
    expect(toNumber(null)).toBeNull();
  });

  it("formata moeda e data no padrao do app", () => {
    expect(formatCurrency(1234.5)).toContain("1.234,50");
    expect(formatDate("2026-05-06")).toBe("06/05/2026");
    expect(formatDate(null)).toBe("-");
  });
});
