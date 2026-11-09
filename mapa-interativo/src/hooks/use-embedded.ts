"use client";

import { useEffect, useState } from "react";

/**
 * True quando o mapa está embutido no site do artigo (dentro de um iframe ou com ?embed=1).
 * Nesse modo, cabeçalho e rodapé ficam ocultos e só o mapa aparece.
 */
export function useEmbedded(): boolean {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    let dentroDeIframe = false;
    try {
      dentroDeIframe = window.self !== window.top;
    } catch {
      // Acesso a window.top bloqueado por outra origem: também significa iframe.
      dentroDeIframe = true;
    }
    const porParametro = new URLSearchParams(window.location.search).get("embed") === "1";
    setEmbedded(dentroDeIframe || porParametro);
  }, []);

  return embedded;
}
