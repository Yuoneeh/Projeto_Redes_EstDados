import { NextResponse } from "next/server";

const HF_SPACE_URL = "https://gschmiidt-preditor-redes-api.hf.space";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      z_robusto = 0,
      aumento_pct = 0,
      jitter_relativo = 1,
      perda_pacotes = 0,
      timeout_atual = 0,
      n5_timeout = 0,
      n5_aumento80 = 0,
      n5_risco = 0,
    } = body;

    // Gradio API: 1) POST /gradio_api/call/predict -> { event_id }
    const callRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          Number(z_robusto),
          Number(aumento_pct),
          Number(jitter_relativo),
          Number(perda_pacotes),
          Number(timeout_atual),
          Number(n5_timeout),
          Number(n5_aumento80),
          Number(n5_risco),
        ],
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!callRes.ok) {
      return NextResponse.json(
        { error: "HF Space indisponível", status: callRes.status },
        { status: 502 }
      );
    }

    const { event_id } = await callRes.json();
    if (!event_id) {
      return NextResponse.json(
        { error: "event_id ausente na resposta do Gradio" },
        { status: 502 }
      );
    }

    // 2) GET /gradio_api/call/predict/<event_id> (SSE)
    const resultRes = await fetch(
      `${HF_SPACE_URL}/gradio_api/call/predict/${event_id}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!resultRes.ok) {
      return NextResponse.json(
        { error: "Erro ao ler resultado do Gradio" },
        { status: 502 }
      );
    }

    const sseText = await resultRes.text();
    const dataLine = sseText
      .split("\n")
      .find((line) => line.startsWith("data: "));

    if (!dataLine) {
      return NextResponse.json(
        { error: "Resposta SSE inválida", raw: sseText },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(dataLine.slice(6));
    const prediction = Array.isArray(parsed) ? parsed[0] : parsed;

    return NextResponse.json({
      source: "huggingface-random-forest",
      ...prediction,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Timeout ou falha na API Random Forest", details: err?.message },
      { status: 504 }
    );
  }
}
