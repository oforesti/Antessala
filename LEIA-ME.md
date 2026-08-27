# Antessala — como colocar no ar e virar app

## O que está aqui

| Arquivo | Para que serve |
|---|---|
| `index.html` | O app inteiro: Resolver, Fichas, Preparação, Atividades, Indicações, Avaliação, Conta |
| `manifest.webmanifest` | Faz o Android/iOS reconhecerem como app instalável |
| `sw.js` | Abre offline depois da primeira visita |
| `icon-*.png`, `apple-touch-icon.png` | Ícone da porta entreaberta |
| `servidor-exemplo.js` | Servidor mínimo que guarda a chave da API |

O app guarda tudo no próprio aparelho: sua roda, as fichas, o histórico. Para montar cenas e escrever devolutivas ele precisa da IA conectada — dentro do Claude ela já vem ligada; publicado em outro lugar, aponte para o seu servidor (passo 3). Instalação como app e modo offline só ligam com o site em HTTPS.

---

## 1. Publicar (5 minutos, de graça)

Arraste a pasta inteira em **app.netlify.com/drop**. Sai uma URL HTTPS na hora, do tipo `antessala-xyz.netlify.app`. Vercel e Cloudflare Pages fazem o mesmo. Quando registrar `antessala.com.br`, é só apontar o domínio.

## 2. Instalar no celular

Abra a URL no Chrome do Android → menu → **Instalar app**. No iPhone, Safari → Compartilhar → **Adicionar à Tela de Início**. Ele abre em tela cheia, com ícone, sem barra de navegador. Para a maioria das pessoas, isso já é "o app".

## 3. Ligar a IA de verdade

Sem isso, o app roda com três cenas prontas.

1. Suba o `servidor-exemplo.js` em Railway, Render ou Fly (todos têm plano gratuito).
2. Configure a variável `ANTHROPIC_API_KEY` lá, e `ORIGENS` com o domínio do app.
3. No app, toque no ícone de conexão no topo e cole a URL do servidor.

**Nunca publique o app com a chave colada no campo de chave.** Ela fica visível para qualquer pessoa que abrir o código da página, e o consumo vai para a sua conta. O campo de chave existe só para você testar no seu aparelho.

## 4. Gerar o APK

Com o site publicado e instalável, o APK sai dele:

1. Vá em **pwabuilder.com** e cole a URL do app.
2. Ele valida o manifesto e o service worker (os dois já estão prontos aqui).
3. **Package for stores → Android** → baixe o pacote.
4. Vem um `.apk` para testar direto no celular e um `.aab` para a Play Store.

O que só você pode fazer: gerar e guardar a chave de assinatura (o PWABuilder cria, mas quem guarda é você — perdeu, não atualiza mais o app nunca), pagar os US$ 25 únicos da conta de desenvolvedor Google e escrever a política de privacidade, que a Play Store exige.

Um APK gerado assim é o site rodando em tela cheia dentro de um app nativo. Para o que a Antessala faz, é indistinguível de um app "de verdade" — e você continua corrigindo tudo publicando o site, sem passar por revisão da loja a cada ajuste.

---

## As abas

- **Resolver** — conte a situação (escrevendo ou falando) e entre na cena.
- **Fichas** — as pessoas com quem você convive: roda, nota de relação de 0 a 10, anotações e histórico.
- **Preparação** — apresentação, entrevista, negociação, feedback, conversa difícil, falar em público. Sai roteiro + o que ensaiar + vídeos.
- **Atividades** — tudo que você combinou consigo mesmo fica em aberto até você contar como foi.
- **Indicações** — acervo curado de livros, filmes, palestras e vídeos, filtrado pelos seus pontos mais fracos.
- **Avaliação** — o diagnóstico e a roda, com a origem de cada ponto.
- **Conta** — nome, idade, situação de trabalho. Se estiver procurando emprego, o currículo entra aqui.

## O que já funciona de verdade

- **Diagnóstico de entrada** marca o ponto de partida da roda.
- **Qualquer situação vira cena**: a IA monta a ficha da pessoa, a roda dela e a primeira fala.
- **Ator e Avaliador separados**, como projetado: o Ator não sabe que existe nota; o Avaliador só vê a transcrição no fim e precisa citar sua frase literalmente.
- **A roda se move só quando você refaz a cena** e sustenta o ajuste — com origem registrada em "de onde vieram os pontos".
- **Fichas, diário e histórico** ficam salvos no aparelho, e você apaga quando quiser.
- **Porta de saída** em duas camadas: lista de termos no app e checagem do modelo.
- **Ditado por voz** para relatos, respostas e currículo (Chrome; em outros navegadores, escrevendo).
- **Nota de relação por pessoa**, que nasce do relato de criação e muda com o que você anota depois — você escolhe se cada episódio mexe na relação, na roda dela, nos dois ou em nada.
- **Retorno de atividade** que pode mover a sua roda e a nota da relação, com origem registrada.
- **Busca de vagas**: a IA lê currículo + roda e devolve cargos, palavras-chave e filtros, com botões que abrem a busca real no LinkedIn.

## O que ainda falta para virar produto

- **Nada sincroniza entre aparelhos.** Tudo mora no navegador daquele celular. Sincronizar pede conta de usuário e banco.
- **Não há login, cobrança nem painel do RH.**
- **A avaliação de colegas** (a terceira fonte da roda) ainda não existe.
- **Vagas do LinkedIn são caminhos de busca, não anúncios.** Não existe API pública de vagas; listar empresas contratando seria invenção. O app monta a busca certa e abre o LinkedIn real.
- **Ditado depende do navegador.** Safari e alguns Android não têm a API de voz.
- **Teste a porta de saída de propósito** antes de qualquer usuário real, e amplie a lista de termos.
