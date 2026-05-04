import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoGestao",
  description: "Sistema de gestao para escritorios de agrimensura.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
