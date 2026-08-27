import equipmentProfiles from "@/lib/modules/rw5/equipment_profiles.json";

export type Rw5EquipmentProfile = {
  key: string;
  aliases: string[];
  receiver_model: string;
  antenna_type: string;
  connection: string;
  serial_number: string;
  firmware: string;
  ra: number | "xxx";
  shmp: number | "xxx";
  l1: number | "xxx";
  l2: number | "xxx";
  hr_offset: number | "xxx";
  default_base_hr?: number;
  requires_confirmation?: boolean;
  source_note?: string;
};

const PROFILES = equipmentProfiles as Record<string, Rw5EquipmentProfile>;

export function listRw5EquipmentProfiles() {
  return Object.values(PROFILES).map((profile) => ({ ...profile, aliases: [...profile.aliases] }));
}

export function findRw5EquipmentCandidates(value?: string | null) {
  const normalized = equipmentKey(value);
  if (!normalized) return [];
  return listRw5EquipmentProfiles().filter((profile) =>
    [profile.key, profile.receiver_model, profile.antenna_type, ...profile.aliases]
      .some((candidate) => equipmentKey(candidate) === normalized),
  );
}

export function resolveRw5EquipmentProfile({
  selected,
  detected,
  role,
}: {
  selected?: string | null;
  detected?: string | null;
  role: "rover" | "base";
}) {
  const selectedKey = String(selected ?? "").trim();
  if (selectedKey && selectedKey !== "auto") {
    const exact = PROFILES[selectedKey];
    const candidates = exact ? [exact] : findRw5EquipmentCandidates(selectedKey);
    if (candidates.length !== 1) {
      throw new Error(`Selecione um perfil unico de equipamento para ${role === "base" ? "a base" : "o rover"}.`);
    }
    assertCompleteProfile(candidates[0], role);
    return { ...candidates[0], aliases: [...candidates[0].aliases] };
  }

  const candidates = findRw5EquipmentCandidates(detected);
  const complete = candidates.filter((profile) => missingRw5EquipmentFields(profile).length === 0 && !profile.requires_confirmation);
  if (complete.length === 1) return { ...complete[0], aliases: [...complete[0].aliases] };
  if (!candidates.length) {
    throw new Error(`Nao foi encontrado perfil de equipamento para ${role === "base" ? "a base" : "o rover"} (${detected || "nao detectado"}).`);
  }
  throw new Error(`Ha mais de um perfil possivel ou dados pendentes para ${role === "base" ? "a base" : "o rover"} (${detected || "nao detectado"}). Selecione o serial correto.`);
}

export function missingRw5EquipmentFields(profile: Rw5EquipmentProfile) {
  return [
    ["SN", profile.serial_number],
    ["FW", profile.firmware],
    ["conexao", profile.connection],
    ["RA", profile.ra],
    ["SHMP", profile.shmp],
    ["L1", profile.l1],
    ["L2", profile.l2],
    ["offset HR", profile.hr_offset],
  ]
    .filter(([, value]) => value === "xxx" || value === "" || value === null || value === undefined)
    .map(([label]) => String(label));
}

export function equipmentProfileLabel(profile: Rw5EquipmentProfile) {
  const pending = missingRw5EquipmentFields(profile);
  const suffix = pending.length ? ` - pendente: ${pending.join(", ")}` : profile.requires_confirmation ? " - confirmar conflito de laudo" : "";
  return `${profile.receiver_model} / ${profile.antenna_type} / SN ${profile.serial_number || "nao informado"}${suffix}`;
}

function assertCompleteProfile(profile: Rw5EquipmentProfile, role: "rover" | "base") {
  const missing = missingRw5EquipmentFields(profile);
  if (missing.length) {
    throw new Error(`Perfil de ${role === "base" ? "base" : "rover"} ${profile.key} incompleto: ${missing.join(", ")}. Cadastre os dados antes de gerar o RW5.`);
  }
}

function equipmentKey(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
