/*
  Antessala — servidor mínimo (Node 18+, sem dependências).
  Ele existe por um motivo só: a chave da API fica AQUI, no servidor,
  e nunca dentro do app no celular do usuário.

  Rodar local:
    ANTHROPIC_API_KEY=sk-ant-... node servidor-exemplo.js
    depois, no app, em "Conectar a IA", ponha: http://localhost:8787/api/antessala

  Em produção, publique isto em qualquer serviço Node (Railway, Render, Fly,
  Cloud Run) e use a URL pública no lugar.
*/

const http = require("http");

const CHAVE = process.env.ANTHROPIC_API_KEY;
const PORTA = process.env.PORT || 8787;
const ORIGENS = (process.env.ORIGENS || "*").split(","); // em produção, liste só o domínio do app

if (!CHAVE) {
  console.error("Falta a variável ANTHROPIC_API_KEY.");
  process.exit(1);
}

const servidor = http.createServer(async (req, res) => {
  const origem = req.headers.origin || "";
  const liberada = ORIGENS.includes("*") ? "*" : (ORIGENS.includes(origem) ? origem : "");

  res.setHeader("Access-Control-Allow-Origin", liberada);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  if (req.method !== "POST" || !req.url.startsWith("/api/antessala")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ erro: "rota não encontrada" }));
    return;
  }

  let corpo = "";
  req.on("data", (p) => {
    corpo += p;
    if (corpo.length > 200000) req.destroy(); // trava pedido gigante
  });

  req.on("end", async () => {
    try {
      const pedido = JSON.parse(corpo);

      // teto de gasto por chamada — ajuste conforme seu bolso
      const payload = {
        model: pedido.model || "claude-sonnet-4-6",
        max_tokens: Math.min(pedido.max_tokens || 900, 2000),
        system: pedido.system,
        messages: pedido.messages
      };

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CHAVE,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(payload)
      });

      const dados = await r.text();
      res.writeHead(r.status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": liberada });
      res.end(dados);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": liberada });
      res.end(JSON.stringify({ erro: String(e.message || e) }));
    }
  });
});

servidor.listen(PORTA, () => console.log("Antessala rodando na porta " + PORTA));
