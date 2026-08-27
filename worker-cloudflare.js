/*
  Antessala — servidor em Cloudflare Workers. Gemini, ou a IA da própria Cloudflare.

  Caminhos, na ordem:
    1. GEMINI_API_KEY configurada  -> Google Gemini
    2. binding Workers AI          -> IA da Cloudflare, sem chave e sem cartão

  ------------------------------------------------------------------
  COMO SUBIR, TUDO PELO NAVEGADOR (uns 5 minutos)
  ------------------------------------------------------------------
  1. dash.cloudflare.com -> conta gratuita, não pede cartão.
  2. Workers & Pages -> Create -> Start with Hello World -> Deploy.
  3. Edit code -> apague tudo -> cole este arquivo -> Deploy.
  4. Settings -> Variables and Secrets -> Add
        Nome: GEMINI_API_KEY     Valor: sua chave      (marque Secret)
     Ou, se preferir sem chave nenhuma:
        Settings -> Bindings -> Add -> Workers AI, Variable name: AI
     Faça Deploy de novo.
  5. No app: Endereço do servidor =
        https://SEU-WORKER.workers.dev/api/antessala
  ------------------------------------------------------------------
*/

const BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODELOS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
const MODELO_CF = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
  async fetch(request, env) {
    const origem = request.headers.get("Origin") || "";
    const permitidas = (env.ORIGENS || "*").split(",");
    const liberada = permitidas.includes("*") ? "*" : (permitidas.includes(origem) ? origem : "");

    const cab = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": liberada,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cab });

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/antessala")) {
      return new Response(JSON.stringify({ error: { message: "rota não encontrada" } }), { status: 404, headers: cab });
    }

    if (request.method === "GET") {
      const provedor = env.GEMINI_API_KEY ? "gemini" : (env.AI ? "cloudflare" : "nenhum");
      return new Response(JSON.stringify({ ok: provedor !== "nenhum", provedor }), { status: 200, headers: cab });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { message: "método não permitido" } }), { status: 405, headers: cab });
    }

    let pedido;
    try { pedido = await request.json(); }
    catch (e) { return new Response(JSON.stringify({ error: { message: "corpo inválido" } }), { status: 400, headers: cab }); }

    const maxTokens = Math.min(pedido.max_tokens || 1000, 4000);
    const ok = (texto) => new Response(
      JSON.stringify({ content: [{ type: "text", text: String(texto) }] }),
      { status: 200, headers: cab }
    );

    try {
      /* ---------- Gemini ---------- */
      if (env.GEMINI_API_KEY) {
        const chave = String(env.GEMINI_API_KEY).trim();
        const corpo = {
          contents: (pedido.messages || []).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: String(m.content) }]
          })),
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 }
        };
        if (pedido.system) corpo.system_instruction = { parts: [{ text: pedido.system }] };

        const formas = [
          { cab: { "x-goog-api-key": chave }, query: "" },
          { cab: {}, query: "?key=" + encodeURIComponent(chave) },
          { cab: { Authorization: "Bearer " + chave }, query: "" }
        ];
        const falhas = [];

        for (const modelo of (env.GEMINI_MODEL ? [env.GEMINI_MODEL] : []).concat(MODELOS)) {
          for (const forma of formas) {
            const r = await fetch(BASE + encodeURIComponent(modelo) + ":generateContent" + forma.query, {
              method: "POST",
              headers: Object.assign({ "Content-Type": "application/json" }, forma.cab),
              body: JSON.stringify(corpo)
            });
            const texto = await r.text();
            let dados = null;
            try { dados = JSON.parse(texto); } catch (_) {}

            if (r.ok) {
              const cand = (dados.candidates || [])[0] || {};
              const partes = (cand.content && cand.content.parts) || [];
              return ok(partes.map((p) => p.text || "").join(""));
            }
            falhas.push(modelo + ": " + r.status);
            if (r.status === 404) break;
            if (r.status !== 401 && r.status !== 403 && r.status !== 400) {
              const msg = (dados && dados.error && dados.error.message) || texto.slice(0, 160);
              return new Response(JSON.stringify({ error: { message: msg } }), { status: r.status, headers: cab });
            }
          }
        }
        return new Response(JSON.stringify({
          error: { message: "Gemini recusou a chave em todas as tentativas: " + falhas.slice(0, 6).join(", ") }
        }), { status: 401, headers: cab });
      }

      /* ---------- Workers AI, sem chave ---------- */
      if (env.AI) {
        const mensagens = [];
        if (pedido.system) mensagens.push({ role: "system", content: pedido.system });
        (pedido.messages || []).forEach((m) => {
          mensagens.push({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) });
        });
        const saida = await env.AI.run(env.CF_MODELO || MODELO_CF, {
          messages: mensagens, max_tokens: maxTokens, temperature: 0.8
        });
        const texto = (saida && (saida.response || saida.result || saida.text)) || "";
        if (!texto) {
          return new Response(JSON.stringify({ error: { message: "Workers AI respondeu vazio. Confira o binding AI." } }), { status: 502, headers: cab });
        }
        return ok(texto);
      }

      return new Response(JSON.stringify({
        error: { message: "Nada configurado. Adicione GEMINI_API_KEY em Variables and Secrets, ou o binding Workers AI com o nome AI, e faça Deploy de novo." }
      }), { status: 500, headers: cab });
    } catch (e) {
      return new Response(JSON.stringify({ error: { message: String(e.message || e) } }), { status: 500, headers: cab });
    }
  }
};
