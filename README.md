# Antessala

Ensaie a conversa difícil antes de ter que ter.

## Estrutura

```
antessala/
├── api/
│   └── antessala.js        função de servidor — a chave vive aqui
├── public/
│   ├── index.html          o app inteiro
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icon-*.png
├── .env.example            modelo das variáveis
├── .gitignore              impede a chave de ir para o Git
├── package.json
└── vercel.json
```

O app procura sozinho por `/api/antessala` assim que abre. Achando, usa esse servidor e você não configura nada na tela. A chave nunca chega ao navegador de quem usa.

---

## 1. Colocar a chave

**Local**

```bash
cp .env.example .env.local
```

Abra o `.env.local` e escreva a chave depois do `=`:

```
ANTHROPIC_API_KEY=sk-ant-sua-chave-aqui
```

Ou, se preferir o Gemini, comente a linha da Anthropic e use `GEMINI_API_KEY=`.

O `.env.local` está no `.gitignore`. Ele fica só na sua máquina.

**Produção (Vercel)**

Não suba arquivo nenhum com a chave. No painel:

Settings → Environment Variables → Add

| Key | Value | Environments |
|---|---|---|
| `ANTHROPIC_API_KEY` | sua chave | Production, Preview, Development |

Depois de salvar, **faça um novo deploy** — variável nova não entra em deploy antigo.

---

## 2. Rodar local

```bash
npm i -g vercel
vercel dev
```

Abre em `http://localhost:3000`. A função responde em `/api/antessala`.

Para conferir se a chave foi lida, abra `http://localhost:3000/api/antessala` no navegador. Deve responder:

```json
{"ok":true,"provedor":"anthropic"}
```

Se vier `"provedor":"nenhum"`, a variável não chegou.

---

## 3. Publicar

**Pelo terminal**

```bash
vercel --prod
```

**Pelo site**, sem terminal: suba a pasta num repositório do GitHub, vá em `vercel.com/new`, importe o repositório, cadastre a variável de ambiente e faça o deploy.

---

## 4. Conferir

Abra `seu-app.vercel.app/api/antessala` no navegador. Deve responder:

```json
{"ok":true,"provedor":"gemini","auth":"ainda não testado"}
```

Depois da primeira cena, o campo `auth` mostra qual forma de autenticação funcionou (`cabecalho`, `query` ou `bearer`). Se o `ok` vier `false`, a variável não chegou ao deploy.

## 5. Como fica para quem usa

O usuário abre o app e usa. Não existe tela de configuração no caminho dele: assim que a página carrega, o app procura `/api/antessala`, encontra e passa a usar. O ícone de conexão no topo só mostra *IA pronta para uso* — a configuração avançada fica escondida atrás de um link, para você.

---

## Onde ficam os dados de cada pessoa

Roda, fichas, relações, anotações, atividades, preparações e currículo ficam no **navegador de cada usuário**, separados por aparelho. O servidor só recebe o texto necessário para a chamada da IA e não guarda nada.

Isso significa:

- cada pessoa tem os próprios dados, sem login e sem banco;
- ninguém vê os dados de ninguém;
- **trocar de aparelho começa do zero.** Na aba Conta há *Baixar meus dados* e *Restaurar de um arquivo* para levar tudo de um celular para outro.

Para que os dados sigam a pessoa em qualquer aparelho, é preciso login e banco de dados — outra etapa, com custo e responsabilidade sobre dado pessoal de terceiros (as fichas falam sobre colegas). Vale fazer só quando houver assinantes.

## Trocar de provedor depois

Só mexer na variável de ambiente e redeployar. O app não muda.

- Claude: `ANTHROPIC_API_KEY` — melhor qualidade nas cenas e nas devolutivas
- Gemini: `GEMINI_API_KEY` — tem faixa gratuita
- Cloudflare Workers AI: use o `worker-cloudflare.js` do outro pacote, que não precisa de chave nenhuma

---

## Antes de abrir para outras pessoas

- **Teto de gasto.** No painel do provedor, defina um limite mensal. Cada cena são três ou quatro chamadas.
- **Limite por usuário.** Hoje não existe: quem tiver o link usa à vontade, na sua conta. Antes de divulgar, você vai precisar de login e de uma cota por pessoa.
- **`ORIGENS`.** Defina com o domínio do seu app para que só ele possa chamar sua função.
- **Dados.** Roda, fichas, atividades e currículo ficam no navegador de cada um. Nada é enviado ao servidor além do texto necessário para a chamada da IA.
