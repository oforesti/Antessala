/*
  Antessala — servidor em Cloudflare Workers.

  Ele tenta três caminhos e usa o primeiro disponível:

    1. Anthropic   — se você configurar ANTHROPIC_API_KEY.
    2. Gemini      — se você configurar GEMINI_API_KEY.
    3. Workers AI  — a IA da própria Cloudflare. NÃO precisa de chave nenhuma
                     e não pede cartão. É por onde você começa.

  ------------------------------------------------------------------
  COMO SUBIR, TUDO PELO NAVEGADOR DO CELULAR (uns 5 minutos)
  ------------------------------------------------------------------
  1. Crie conta em dash.cloudflare.com. O plano gratuito não pede cartão.

  2. Workers & Pages -> Create -> Start with Hello World -> Deploy.
     Anote o endereço que aparecer, algo como
     antessala.SEU-USUARIO.workers.dev

  3. Abra o Worker -> Edit code. Apague tudo que estiver lá, cole ESTE
     arquivo inteiro e clique em Deploy.

  4. ESTE É O PASSO QUE LIGA A IA:
     Settings -> Bindings -> Add -> Workers AI
     Variable name:  AI      (exatamente assim, em maiúsculas)
     Salve e faça Deploy de novo.

  5. No app, ícone de conexão no topo:
     Endereço do seu servidor:
       https://antessala.SEU-USUARIO.workers.dev/api/antessala
     Campo da chave: DEIXE VAZIO.
     Toque em Testar conexão.

  Depois, se quiser respostas melhores: Settings -> Variables and Secrets,
  adicione GEMINI_API_KEY ou ANTHROPIC_API_KEY. O Worker passa a usar essa
  sozinho, e você não mexe em nada no app.
  ------------------------------------------------------------------
*/

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
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cab });

    const url = new URL(request.url);
    if (request.method !== "POST" || !url.pathname.startsWith("/api/antessala")) {
      return new Response(JSON.stringify({ error: { message: "rota não encontrada" } }), { status: 404, headers: cab });
    }

    let pedido;
    try {
      pedido = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: { message: "corpo inválido" } }), { status: 400, headers: cab });
    }

    const maxTokens = Math.min(pedido.max_tokens || 1000, 4000);
    const resposta = (texto) => new Response(
      JSON.stringify({ content: [{ type: "text", text: String(texto) }] }),
      { status: 200, headers: cab }
    );

    try {
      /* ---------- 1. Anthropic, se houver chave ---------- */
      if (env.ANTHROPIC_API_KEY) {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: pedido.model || "claude-sonnet-5",
            max_tokens: maxTokens,
            system: pedido.system,
            messages: pedido.messages
          })
        });
        return new Response(await r.text(), { status: r.status, headers: cab });
      }

      /* ---------- 2. Gemini, se houver chave ---------- */
      if (env.GEMINI_API_KEY) {
        const modelo = env.GEMINI_MODEL || "gemini-2.5-flash";
        const corpo = {
          contents: (pedido.messages || []).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: String(m.content) }]
          })),
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 }
        };
        if (pedido.system) corpo.system_instruction = { parts: [{ text: pedido.system }] };

        const r = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" +
            encodeURIComponent(modelo) + ":generateContent?key=" + env.GEMINI_API_KEY,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
        );

        const texto = await r.text();
        let dados = null;
        try { dados = JSON.parse(texto); } catch (_) {}

        if (!r.ok) {
          const msg = (dados && dados.error && dados.error.message) || texto.slice(0, 200);
          return new Response(JSON.stringify({ error: { type: "gemini_error", message: msg } }), { status: r.status, headers: cab });
        }

        const partes = ((dados.candidates || [])[0] || {}).content;
        const lista = (partes && partes.parts) || [];
        return resposta(lista.map((p) => p.text || "").join(""));
      }

      /* ---------- 3. Workers AI: sem chave, sem cartão ---------- */
      if (env.AI) {
        const mensagens = [];
        if (pedido.system) mensagens.push({ role: "system", content: pedido.system });
        (pedido.messages || []).forEach((m) => {
          mensagens.push({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content)
          });
        });

        const saida = await env.AI.run(env.CF_MODELO || MODELO_CF, {
          messages: mensagens,
          max_tokens: maxTokens,
          temperature: 0.8
        });

        const texto = (saida && (saida.response || saida.result || saida.text)) || "";
        if (!texto) {
          return new Response(JSON.stringify({
            error: { message: "Workers AI respondeu vazio. Confira o binding AI em Settings -> Bindings." }
          }), { status: 502, headers: cab });
        }
        return resposta(texto);
      }

      return new Response(JSON.stringify({
        error: { message: "Nada configurado ainda. Vá em Settings -> Bindings -> Add -> Workers AI, com Variable name AI, e faça Deploy de novo." }
      }), { status: 500, headers: cab });

    } catch (e) {
      return new Response(JSON.stringify({ error: { message: String(e.message || e) } }), { status: 500, headers: cab });
    }
  }
};
