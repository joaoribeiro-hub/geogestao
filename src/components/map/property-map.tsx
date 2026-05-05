"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatDate } from "@/lib/utils";
import type { Json } from "@/types/database";

export type MapFeature = {
  id: string;
  geojson: Json;
  property: {
    name: string;
    area: number | null;
    registry_number: string | null;
    registry_date: string | null;
    car_state: string | null;
    car_federal: string | null;
    city: string | null;
    state: string | null;
  };
  client: {
    name: string;
  } | null;
  service: {
    id: string;
    title: string;
    payment_status?: string;
  } | null;
};

export function PropertyMap({ features }: { features: MapFeature[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.FeatureGroup | null>(null);
  const stableFeatures = useMemo(() => features, [features]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: [-15.78, -47.93],
        zoom: 4,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;
    if (layerRef.current) {
      layerRef.current.remove();
    }

    const group = L.featureGroup();
    stableFeatures.forEach((feature) => {
      const geojson = feature.geojson as unknown as GeoJSON.GeoJsonObject;
      const layer = L.geoJSON(geojson, {
        style: {
          color: "#166534",
          fillColor: "#22c55e",
          fillOpacity: 0.18,
          weight: 2,
        },
      });

      layer.bindPopup(renderPopup(feature), {
        maxWidth: 360,
      });
      group.addLayer(layer);
    });

    group.addTo(map);
    layerRef.current = group;

    if (group.getLayers().length) {
      map.fitBounds(group.getBounds(), { padding: [28, 28] });
    }

    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      group.remove();
    };
  }, [stableFeatures]);

  return (
    <div
      ref={containerRef}
      className="h-[620px] min-h-[420px] overflow-hidden rounded-lg border bg-secondary"
    />
  );
}

function renderPopup(feature: MapFeature) {
  const serviceLink = feature.service
    ? `<a href="/servicos/${feature.service.id}" style="color:#166534;font-weight:600;">Abrir servico</a>`
    : "Sem servico vinculado";

  return `
    <div style="font-family:Inter,system-ui,sans-serif;min-width:240px">
      <strong>${escapeHtml(feature.property.name)}</strong>
      <div style="margin-top:6px;color:#475569;font-size:12px">
        <div><b>Cliente:</b> ${escapeHtml(feature.client?.name ?? "-")}</div>
        <div><b>Servico:</b> ${escapeHtml(feature.service?.title ?? "-")}</div>
        <div><b>Status:</b> ${escapeHtml(feature.service?.payment_status ?? "-")}</div>
        <div><b>Area:</b> ${feature.property.area ?? "-"}</div>
        <div><b>Matricula:</b> ${escapeHtml(feature.property.registry_number ?? "-")}</div>
        <div><b>Data matricula:</b> ${escapeHtml(formatDate(feature.property.registry_date))}</div>
        <div><b>CAR Estadual:</b> ${escapeHtml(feature.property.car_state ?? "-")}</div>
        <div><b>CAR Federal:</b> ${escapeHtml(feature.property.car_federal ?? "-")}</div>
        <div><b>Municipio/UF:</b> ${escapeHtml([feature.property.city, feature.property.state].filter(Boolean).join("/") || "-")}</div>
        <div style="margin-top:8px">${serviceLink}</div>
      </div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
