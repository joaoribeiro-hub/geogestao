"use client";

import dynamic from "next/dynamic";
import type { MapFeature } from "@/components/map/property-map";

const PropertyMap = dynamic(
  () => import("@/components/map/property-map").then((mod) => mod.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[620px] min-h-[420px] items-center justify-center rounded-lg border bg-secondary text-sm text-muted-foreground">
        Carregando mapa...
      </div>
    ),
  },
);

export function PropertyMapClient({ features }: { features: MapFeature[] }) {
  return <PropertyMap features={features} />;
}
