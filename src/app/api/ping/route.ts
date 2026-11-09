import { NextResponse } from "next/server";
import { execFile } from "child_process";
import dns from "dns/promises";

interface GeoInfo {
  ip: string;
  lat: number;
  lon: number;
  city: string;
  country: string;
  countryCode: string;
}

// Cache de geolocalização para não sobrecarregar API externa
const geoCache = new Map<string, GeoInfo>();
let clientGeoCache: GeoInfo | null = null;

async function getClientGeo(): Promise<GeoInfo> {
  if (clientGeoCache) return clientGeoCache;
  try {
    const res = await fetch("http://ip-api.com/json/?fields=status,country,countryCode,city,lat,lon,query", {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    if (data.status === "success") {
      clientGeoCache = {
        ip: data.query,
        lat: Number(data.lat),
        lon: Number(data.lon),
        city: data.city || "Local",
        country: data.country || "Brasil",
        countryCode: data.countryCode || "BR",
      };
      return clientGeoCache;
    }
  } catch (e) {
    console.error("Erro ao obter geo do cliente:", e);
  }
  return {
    ip: "127.0.0.1",
    lat: -23.5505,
    lon: -46.6333,
    city: "São Paulo",
    country: "Brasil",
    countryCode: "BR",
  };
}

async function getTargetGeo(targetIp: string): Promise<GeoInfo> {
  if (geoCache.has(targetIp)) {
    return geoCache.get(targetIp)!;
  }

  // Verifica se é IP privado / loopback
  if (
    targetIp.startsWith("192.168.") ||
    targetIp.startsWith("10.") ||
    targetIp.startsWith("172.16.") ||
    targetIp.startsWith("127.") ||
    targetIp === "localhost"
  ) {
    const client = await getClientGeo();
    const localGeo: GeoInfo = {
      ip: targetIp,
      lat: client.lat + 0.05,
      lon: client.lon + 0.05,
      city: "Rede Local (LAN)",
      country: client.country,
      countryCode: client.countryCode,
    };
    geoCache.set(targetIp, localGeo);
    return localGeo;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${targetIp}?fields=status,country,countryCode,city,lat,lon,query`, {
      signal: AbortSignal.timeout(3500),
    });
    const data = await res.json();
    if (data.status === "success") {
      const info: GeoInfo = {
        ip: targetIp,
        lat: Number(data.lat),
        lon: Number(data.lon),
        city: data.city || "Destino",
        country: data.country || "Internacional",
        countryCode: data.countryCode || "UN",
      };
      geoCache.set(targetIp, info);
      return info;
    }
  } catch (e) {
    console.error("Erro ao obter geo do alvo:", e);
  }

  // Fallback padrão se API falhar
  return {
    ip: targetIp,
    lat: 37.751,
    lon: -122.42,
    city: "Destino Remoto",
    country: "Estados Unidos",
    countryCode: "US",
  };
}

function runPing(targetIp: string): Promise<{ rtt: number | null; loss: number }> {
  return new Promise((resolve) => {
    // Windows ping: 1 pacote, timeout de 1500ms
    execFile("ping", ["-n", "1", "-w", "1500", targetIp], (error, stdout) => {
      if (error || !stdout) {
        return resolve({ rtt: null, loss: 100 });
      }

      // Regex para português ("tempo=Xms" ou "tempo<1ms") e inglês ("time=Xms" ou "time<1ms")
      const timeMatch = stdout.match(/(?:tempo|time)[=<](\d+)ms/i);
      if (timeMatch && timeMatch[1]) {
        return resolve({ rtt: parseInt(timeMatch[1], 10), loss: 0 });
      }

      if (stdout.includes("<1ms") || stdout.includes("< 1ms")) {
        return resolve({ rtt: 1, loss: 0 });
      }

      // Perda total
      resolve({ rtt: null, loss: 100 });
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let rawTarget = (body.target || "").trim().toLowerCase();

    if (!rawTarget) {
      return NextResponse.json({ error: "Endereço IP ou domínio não informado." }, { status: 400 });
    }

    // Remove protocolo se o usuário colou URL (ex: https://google.com/ -> google.com)
    rawTarget = rawTarget.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0];

    // Sanitização rigorosa contra command injection
    if (!/^[a-zA-Z0-9.-]+$/.test(rawTarget)) {
      return NextResponse.json({ error: "Formato de IP ou domínio inválido." }, { status: 400 });
    }

    // Resolução DNS se for hostname
    let resolvedIp = rawTarget;
    try {
      const dnsResult = await dns.lookup(rawTarget);
      resolvedIp = dnsResult.address;
    } catch {
      // Se não resolver por DNS, tenta como IP direto
    }

    // Busca geolocalização do cliente e do alvo
    const [clientGeo, targetGeo, pingResult] = await Promise.all([
      getClientGeo(),
      getTargetGeo(resolvedIp),
      runPing(resolvedIp),
    ]);

    return NextResponse.json({
      target: rawTarget,
      resolvedIp,
      rtt: pingResult.rtt,
      loss: pingResult.loss,
      client: clientGeo,
      targetGeo,
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao processar ping", details: String(error) },
      { status: 500 }
    );
  }
}
