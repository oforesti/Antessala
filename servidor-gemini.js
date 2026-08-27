/*
  Antessala — servidor com Google Gemini (Node 18+, sem dependências).

  O app fala no formato da Anthropic. Este servidor traduz para o Gemini e
  traduz a resposta de volta, então NADA muda dentro do app: você só cola a
  URL deste servidor no campo "Endereço do seu servidor".

  Por que existe: a chave fica aqui, no servidor, e nunca no celular de quem usa.

  Rodar local:
    GEMINI_API_KEY=... node servidor-gemini.js
    no app, em Conexão da IA: http://localhost:8787/api/antessala

  Publicar: Render, Railway, Fly ou Cloud Run. Configure GEMINI_API_KEY
  e ORIGENS com o domínio do app.

  Pegar a chave: ai.google.dev -> Get API Key (conta Google, sem cartão).
*/

const http = require("http");

const CHAVE   = process.env.GEMINI_API_KEY;
const MODELO  = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const PORTA   = process.env.PORT || 8787;
const ORIGENS = (process.env.ORIGENS || "*").split(",");

if (!CHAVE) {
  console.error("Falta a variável GEMINI_API_KEY.");
  process.exit(1);
}

/* ---- tradução: formato Anthropic (o que o app manda) -> formato Gemini ---- */
function paraGemini(pedido) {
  const contents = (pedido.messages || []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
  }));

  const corpo = {
    contents,
    generationConfig: {
      maxOutputTokens: Math.min(pedido.max_tokens || 1000, 4000),
      temperature: 0.8
    }
  };
  if (pedido.system) corpo.system_instruction = { parts: [{ text: pedido.system }] };
  return corpo;
}

/* ---- tradução: resposta do Gemini -> formato que o app espera ---- */
function paraApp(dados) {
  const cand = (dados.candidates || [])[0];
  const partes = (cand && cand.content && cand.content.parts) || [];
  const texto = partes.map((p) => p.text || "").join("");
  return { content: [{ type: "text", text: texto }] };
}

const servidor = http.createServer((req, res) => {
  const origem = req.headers.origin || "";
  const liberada = ORIGENS.includes("*") ? "*" : (ORIGENS.includes(origem) ? origem : "");

  res.setHeader("Access-Control-Allow-Origin", liberada);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  if (req.method !== "POST" || !req.url.startsWith("/api/antessala")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "rota não encontrada" } }));
    return;
  }

  let corpo = "";
  req.on("data", (p) => { corpo += p; if (corpo.length > 200000) req.destroy(); });

  req.on("end", async () => {
    try {
      const pedido = JSON.parse(corpo);
      const url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + encodeURIComponent(MODELO) + ":generateContent?key=" + CHAVE;

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paraGemini(pedido))
      });

      const texto = await r.text();
      let dados = null;
      try { dados = JSON.parse(texto); } catch (_) {}

      if (!r.ok) {
        // devolve o erro no formato que o app sabe ler
        const msg = (dados && dados.error && dados.error.message) || texto.slice(0, 200);
        res.writeHead(r.status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": liberada });
        res.end(JSON.stringify({ error: { type: "gemini_error", message: msg } }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": liberada });
      res.end(JSON.stringify(paraApp(dados)));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": liberada });
      res.end(JSON.stringify({ error: { message: String(e.message || e) } }));
    }
  });
});

servidor.listen(PORTA, () => console.log("Antessala/Gemini na porta " + PORTA + " — modelo " + MODELO));
