const BRAZIL_TIMEZONE = "America/Sao_Paulo";

export function getBrazilHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hour12: false,
    timeZone: BRAZIL_TIMEZONE,
  }).format(date);
  return Number(hour);
}

export function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function getBrazilGreeting(date = new Date()) {
  return greetingForHour(getBrazilHour(date));
}
