/*
  Antessala — função de servidor (Vercel). Somente Google Gemini.

  A chave fica aqui, lida da variável de ambiente GEMINI_API_KEY, e nunca
  chega ao navegador de quem usa o app.

  Sobre os formatos de chave: o AI Studio emite dois.
     AIzaSy...   antigo, autentica pela query string
     AQ.Ab8...   novo, autentica por cabeçalho
  Esta função tenta as três formas possíveis e guarda a que funcionar.

  Sobre os modelos: se o modelo pedido não existir para a sua chave, ela tenta
  os seguintes da lista automaticamente.

  Local:     .env.local  ->  GEMINI_API_KEY=sua-chave
  Produção:  Vercel -> Settings -> Environment Variables -> depois REDEPLOY
*/

const BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

const MODELOS = (process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : []
).concat([
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite"
]);

/* memória curta do processo: evita repetir tentativa que já falhou */
let authOk = null;
let modeloOk = null;

function formasDeAuth(chave) {
  const todas = [
    { nome: "cabecalho", cab: { "x-goog-api-key": chave }, query: "" },
    { nome: "query", cab: {}, query: "?key=" + encodeURIComponent(chave) },
    { nome: "bearer", cab: { Authorization: "Bearer " + chave }, query: "" }
  ];
  return authOk ? todas.sort((a) => (a.nome === authOk ? -1 : 1)) : todas;
}

function listaModelos() {
  const l = MODELOS.filter((m, i) => MODELOS.indexOf(m) === i);
  return modeloOk ? [modeloOk].concat(l.filter((m) => m !== modeloOk)) : l;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ORIGENS || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();

  /* o app faz um GET só para saber se há servidor configurado.
     nunca devolvemos a chave, só se ela existe */
  if (req.method === "GET") {
    return res.status(200).json({
      ok: !!process.env.GEMINI_API_KEY,
      provedor: process.env.GEMINI_API_KEY ? "gemini" : "nenhum",
      auth: authOk || "ainda não testado",
      modelo: modeloOk || "ainda não testado"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "método não permitido" } });
  }

  const chave = String(process.env.GEMINI_API_KEY || "").trim();
  if (!chave) {
    return res.status(500).json({
      error: { message: "GEMINI_API_KEY não configurada. Cadastre em Settings -> Environment Variables e faça um deploy novo." }
    });
  }

  let pedido;
  try {
    pedido = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: { message: "corpo inválido" } });
  }

  const corpo = {
    contents: (pedido.messages || []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content) }]
    })),
    generationConfig: {
      maxOutputTokens: Math.min(pedido.max_tokens || 1000, 4000),
      temperature: 0.8
    }
  };
  if (pedido.system) corpo.system_instruction = { parts: [{ text: pedido.system }] };

  const falhas = [];

  try {
    for (const modelo of listaModelos()) {
      for (const forma of formasDeAuth(chave)) {
        const r = await fetch(
          BASE + encodeURIComponent(modelo) + ":generateContent" + forma.query,
          {
            method: "POST",
            headers: Object.assign({ "Content-Type": "application/json" }, forma.cab),
            body: JSON.stringify(corpo)
          }
        );

        const texto = await r.text();
        let dados = null;
        try { dados = JSON.parse(texto); } catch (_) {}

        if (r.ok) {
          authOk = forma.nome;
          modeloOk = modelo;
          const cand = (dados.candidates || [])[0] || {};
          const partes = (cand.content && cand.content.parts) || [];
          return res.status(200).json({
            content: [{ type: "text", text: partes.map((p) => p.text || "").join("") }],
            meta: { modelo, auth: forma.nome }
          });
        }

        const msg = (dados && dados.error && dados.error.message) || texto.slice(0, 140);
        falhas.push(modelo + "/" + forma.nome + ": " + r.status + " " + msg);

        /* 404 é modelo inexistente: troca de modelo, não de autenticação */
        if (r.status === 404) break;

        /* erro que não é de credencial nem de modelo: devolve direto */
        if (r.status !== 401 && r.status !== 403 && r.status !== 400) {
          return res.status(r.status).json({ error: { type: "gemini_error", message: msg } });
        }
      }
    }

    return res.status(401).json({
      error: {
        type: "gemini_auth",
        message:
          "O Gemini recusou a chave em todas as combinações de modelo e autenticação. " +
          "Confira se a chave está inteira e sem espaços, e se foi criada em aistudio.google.com/app/apikey. " +
          "Tentativas: " + falhas.slice(0, 6).join(" | ")
      }
    });
  } catch (e) {
    return res.status(500).json({ error: { message: String(e.message || e) } });
  }
}
