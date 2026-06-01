import { describe, expect, it } from "vitest";
import { greetingForHour } from "@/lib/home/greeting";

describe("saudacao do Inicio", () => {
  it("usa Bom dia entre 05:00 e 11:59", () => {
    expect(greetingForHour(5)).toBe("Bom dia");
    expect(greetingForHour(11)).toBe("Bom dia");
  });

  it("usa Boa tarde entre 12:00 e 17:59", () => {
    expect(greetingForHour(12)).toBe("Boa tarde");
    expect(greetingForHour(17)).toBe("Boa tarde");
  });

  it("usa Boa noite entre 18:00 e 04:59", () => {
    expect(greetingForHour(18)).toBe("Boa noite");
    expect(greetingForHour(4)).toBe("Boa noite");
  });
});
