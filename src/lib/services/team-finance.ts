export function buildTeamMemberExpenseDescription(memberName: string) {
  return `Pagamento mensal - ${memberName}`;
}

export function shouldCreateTeamMemberMonthlyExpense(
  amount: number | null | undefined,
): amount is number {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0;
}
