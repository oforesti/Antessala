/*
  Antessala — função de servidor (Vercel).

  A chave da IA fica aqui, lida de variável de ambiente, e nunca chega ao
  navegador de quem usa o app.

  Provedores, na ordem em que são escolhidos:
    ANTHROPIC_API_KEY  -> Claude
    GEMINI_API_KEY     -> Google Gemini

  Sobre as chaves do Gemini: existem dois formatos em circulação.
    AIzaSy...   formato antigo, autentica pela query string
    AQ.Ab8...   formato novo, autentica por cabeçalho
  Esta função tenta os dois jeitos automaticamente e usa o que funcionar.

  Local:     escreva a chave no .env.local
  Produção:  Vercel -> Settings -> Environment Variables (e redeploy depois)
*/

const MODELO_ANTHROPIC = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MODELO_GEMINI = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const BASE_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/";

/* guarda qual forma de autenticação deu certo, para não repetir tentativa */
let jeitoQueFunciona = null;

function jeitosDeAutenticar(chave) {
  const lista = [
    { nome: "cabecalho", cab: { "x-goog-api-key": chave }, query: "" },
    { nome: "query", cab: {}, query: "?key=" + encodeURIComponent(chave) },
    { nome: "bearer", cab: { Authorization: "Bearer " + chave }, query: "" }
  ];
  if (!jeitoQueFunciona) return lista;
  return lista.sort((a) => (a.nome === jeitoQueFunciona ? -1 : 1));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ORIGENS || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();

  /* O app faz um GET aqui só para saber se existe servidor configurado.
     Nunca devolvemos a chave, só se ela existe. */
  if (req.method === "GET") {
    const provedor = process.env.ANTHROPIC_API_KEY ? "anthropic"
                   : (process.env.GEMINI_API_KEY ? "gemini" : "nenhum");
    return res.status(200).json({
      ok: provedor !== "nenhum",
      provedor,
      auth: jeitoQueFunciona || "ainda não testado"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "método não permitido" } });
  }

  const pedido = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const maxTokens = Math.min(pedido.max_tokens || 1000, 4000);

  try {
    /* ---------------- Anthropic ---------------- */
    if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: MODELO_ANTHROPIC,
          max_tokens: maxTokens,
          system: pedido.system,
          messages: pedido.messages
        })
      });
      const texto = await r.text();
      res.setHeader("Content-Type", "application/json");
      return res.status(r.status).send(texto);
    }

    /* ---------------- Gemini ---------------- */
    if (process.env.GEMINI_API_KEY) {
      const chave = String(process.env.GEMINI_API_KEY).trim();

      const corpo = {
        contents: (pedido.messages || []).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: String(m.content) }]
        })),
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 }
      };
      if (pedido.system) corpo.system_instruction = { parts: [{ text: pedido.system }] };

      const falhas = [];

      for (const jeito of jeitosDeAutenticar(chave)) {
        const r = await fetch(
          BASE_GEMINI + encodeURIComponent(MODELO_GEMINI) + ":generateContent" + jeito.query,
          {
            method: "POST",
            headers: Object.assign({ "Content-Type": "application/json" }, jeito.cab),
            body: JSON.stringify(corpo)
          }
        );

        const texto = await r.text();
        let dados = null;
        try { dados = JSON.parse(texto); } catch (_) {}

        if (r.ok) {
          jeitoQueFunciona = jeito.nome;
          const cand = (dados.candidates || [])[0] || {};
          const partes = (cand.content && cand.content.parts) || [];
          return res.status(200).json({
            content: [{ type: "text", text: partes.map((p) => p.text || "").join("") }]
          });
        }

        const msg = (dados && dados.error && dados.error.message) || texto.slice(0, 160);
        falhas.push(jeito.nome + ": " + r.status + " " + msg);

        /* erro que não é de autenticação não adianta tentar de outro jeito */
        if (r.status !== 401 && r.status !== 403 && r.status !== 400) {
          return res.status(r.status).json({ error: { type: "gemini_error", message: msg } });
        }
      }

      return res.status(401).json({
        error: {
          type: "gemini_auth",
          message:
            "A chave do Gemini foi recusada nas três formas de autenticação. " +
            "Chaves no formato AQ. às vezes não valem para a API REST do Generative Language — " +
            "gere uma chave no formato AIzaSy em aistudio.google.com/app/apikey, ou use o Worker da Cloudflare, que não precisa de chave. " +
            "Detalhe: " + falhas.join(" | ")
        }
      });
    }

    return res.status(500).json({
      error: { message: "Nenhuma chave configurada. Defina ANTHROPIC_API_KEY ou GEMINI_API_KEY nas variáveis de ambiente e faça um deploy novo." }
    });
  } catch (e) {
    return res.status(500).json({ error: { message: String(e.message || e) } });
  }
}
