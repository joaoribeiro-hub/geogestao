import type { SophiaV4ModelProvider } from "@/lib/sophia/v4/model-providers/types";

export function createLocalStubProvider(): SophiaV4ModelProvider {
  return { name: "local_stub", model: "local-rules", available: true, generateJson: async () => null };
}
