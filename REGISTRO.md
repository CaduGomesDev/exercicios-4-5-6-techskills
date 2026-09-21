# Registro obrigatório — Exercícios 4, 5 e 6

## Exercício 4 — Logs estruturados (Winston)

**Sintoma:** em produção nenhuma linha de `logger.info` aparecia; quando uma
linha aparecia, trazia o pedido inteiro (`JSON.stringify(order)`), incluindo
dado sensível do cliente.

**Passos para reproduzir:** chamar `processOrder('1')` (pedido válido) e
`processOrder('999')` (pedido inexistente) com o logger original
(`level: 'error'` fixo).

**Resultado esperado:** linhas de início e fim de processamento visíveis, sem
dado sensível.

**Resultado obtido (código original):** nenhuma linha — `logger.info` nunca é
emitido porque o nível do logger (`'error'`) é mais restritivo que o nível da
mensagem (`'info'`); e no caminho de erro a função lança antes de chegar à
linha de "fim do processamento", que também nunca é emitida.

**Hipótese:** o nível fixo do logger está descartando `info` antes mesmo de
formatar a mensagem, e a ausência de `try/catch` corta o fluxo no erro.

**Ferramenta utilizada:** execução direta do serviço via `curl` contra a rota
`/pedidos/:id`, nível controlado por `LOG_LEVEL`.

**Causa encontrada:** `level: 'error'` fixo (não lia `process.env`) e
ausência de tratamento de erro ao redor de `findOrder`.

**Como a correção foi validada:** linha de log real após a correção,
capturada rodando o projeto (`npm run build && node dist/index.js`) e
chamando `GET /pedidos/1` e `GET /pedidos/999`:

```
2026-09-21T22:27:53.474Z [info] inicio do processamento {"orderId":"1"}
2026-09-21T22:27:53.474Z [info] fim do processamento {"orderId":"1","itemCount":2,"total":55.4}
2026-09-21T22:27:53.478Z [info] inicio do processamento {"orderId":"999"}
2026-09-21T22:27:53.478Z [error] falha ao processar pedido {"orderId":"999","err":{"message":"pedido 999 nao encontrado","stack":"Error: pedido 999 nao encontrado\n    at findOrder (dist/services/order.service.js:19:15)\n    at processOrder (dist/services/process-order.js:14:59)..."}}
```

Nenhuma linha inclui `customer` (nome ou cartão do pedido) — o campo sensível
nunca é passado ao logger.

**Cenário `LOG_LEVEL=error`** (mesma requisição em `/erro`), saída real —
somente a linha de erro sobrevive, a linha `request` do middleware (nível
`info`) é suprimida:

```
2026-09-21T22:28:21.996Z [error] erro nao tratado na rota {"route":"/erro","err":{"message":"falha proposital para teste do exercicio 5","stack":"Error: falha proposital..."}}
```

```
antes:  {"orderId":"999","err":{}}
depois: {"orderId":"999","err":{"message":"pedido 999 nao encontrado","stack":"Error: pedido 999 nao encontrado\n    at findOrder..."}}
```

---

## Exercício 5 — Middleware de logging de requisições

**Sintoma:** toda linha de log de requisição saía com `status: 200` e
`duration: 0`, mesmo em rotas 404, com erro ou lentas.

**Passos para reproduzir:** `GET /health`, `/rota-inexistente`, `/erro`,
`/lento` (atraso de 800ms), com o middleware original (lia `res.statusCode`
e `new Date() - start` antes de `next()`, registrado depois de uma rota que
já responde sem chamar `next()`).

**Resultado esperado:** status e duração reais de cada requisição.

**Resultado obtido (código original):** sempre `status: 200`,
`duration: 0` — a leitura acontecia antes do Express processar a rota, e
para `/health` (registrada antes do middleware) o log nem chegava a rodar.

**Hipótese:** é preciso ler `res.statusCode` e medir o tempo depois que a
resposta termina, não logo após chamar o handler; e o middleware precisa
vir antes das rotas para não ser pulado quando a rota responde sem `next()`.

**Ferramenta utilizada:** `res.on('finish', …)` + `process.hrtime.bigint()`
no lugar da subtração de `Date`.

**Causa encontrada:** leitura síncrona de `res.statusCode`/duração logo após
disparar o handler (antes da resposta terminar) e posição do middleware
depois de uma rota terminal.

**Como a correção foi validada:** saída real dos cinco cenários pedidos,
rodando o servidor corrigido e chamando cada rota com `curl`:

```
GET /health              → {"...,"route":"/health","statusCode":200,"durationMs":2.61}
GET /usuarios/42          → {"...,"route":"/usuarios/:id","statusCode":200,"durationMs":0.47}
GET /rota-inexistente     → {"...,"route":"/rota-inexistente","statusCode":404,"durationMs":0.46}
GET /erro                 → {"...,"route":"/erro","statusCode":500,"durationMs":0.61}
GET /lento                → {"...,"route":"/lento","statusCode":200,"durationMs":800.82}
```

- `/usuarios/42` foi registrado como rota `/usuarios/:id` (via
  `req.route?.path`), não como `/usuarios/42` — evita explosão de
  cardinalidade quando o parâmetro varia a cada chamada.
- `/erro` saiu com `statusCode: 500`, não 200.
- `/lento` saiu com `durationMs: 800.82`, coerente com o atraso de 800ms
  aplicado na rota — não zero.
- Cada linha carrega um `requestId` (UUID) que também vai no header de
  resposta `X-Request-Id`, permitindo correlacionar todas as linhas de uma
  mesma requisição (inclusive as emitidas pelo Exercício 4 durante a mesma
  chamada, como em `/pedidos/:id`).

**Ordem de registro dos middlewares** ([`src/app.ts`](src/app.ts)):
`requestLogger` → `express.json()` → rotas → `notFoundHandler` →
`errorHandler`. No original, o middleware vinha depois de uma rota que já
respondia (`app.get('/health', handler)` antes de `app.use(requestLogger)`),
então nunca era alcançado para aquela rota.

---

## Exercício 6 — Diagnóstico de processo com PM2

**Sintoma:** a aplicação responde à primeira chamada de `/crash` e o
processo morre pouco depois; sob PM2 ele volta sozinho, escondendo o
problema de quem só observa o endpoint.

**Passos para reproduzir:** subir a aplicação (código original do
enunciado) sob PM2 com `ecosystem.config.js`, chamar `GET /crash` e observar
`pm2 list` / `pm2 logs api --err`.

**Resultado esperado:** processo estável, log de erro estruturado, sem
reinício.

**Resultado obtido (código original, evidência real capturada):**

`pm2 list` antes da chamada — `pid 75455`, `↺ 0` (restarts):
```
│ 0  │ api │ fork │ pid 75455 │ uptime 2s │ ↺ 0 │ online │
```

Depois de `curl http://localhost:3000/crash` — `pid` mudou para `75565` e o
contador de restart foi para `1`, confirmando que o processo morreu e o PM2
reiniciou:
```
│ 0  │ api │ fork │ pid 75565 │ uptime 2s │ ↺ 1 │ online │
```

`pm2 logs api --err` mostrou o stack real do crash:
```
Error: falha ao processar a fila
    at Timeout._onTimeout (dist/routes/demo.routes.js:46:15)
    at listOnTimeout (node:internal/timers:581:17)
    at process.processTimers (node:internal/timers:519:7)
```

**Hipótese:** a exceção é lançada dentro do callback assíncrono do
`setTimeout`, fora da pilha de chamadas da requisição HTTP — não é um erro
síncrono na rota nem uma Promise rejeitada que o Express consiga interceptar.
Vira uma `uncaughtException` do processo Node como um todo, não um erro de
uma requisição.

**Por que o middleware de erro do Express não captura:** o middleware de
erro (`(err, req, res, next) => …`) só é acionado quando o erro chega via
`next(err)` dentro do ciclo síncrono/Promise da requisição. Um `throw`
dentro de um `setTimeout` já rodou fora desse ciclo — a requisição original
(`/crash`) já tinha respondido `200` havia 100ms.

**Causa encontrada:** ausência de tratamento de erro ao redor do código
assíncrono em segundo plano, combinada com a ausência de um handler de
`process.on('uncaughtException', …)` — sem ele, o comportamento padrão do
Node é imprimir o stack e encerrar o processo com código de saída 1.

**Correção aplicada:**
1. [`src/routes/demo.routes.ts`](src/routes/demo.routes.ts) — o "processamento em fila" captura seu próprio erro (`try/catch` local) e loga via `logger.error`, sem deixar nada escapar para o processo.
2. [`src/index.ts`](src/index.ts) — `uncaughtException`/`unhandledRejection` continuam tratados como rede de segurança (loga com stack e `process.exit(1)`, para o PM2 identificar um crash real caso algo realmente inesperado escape), e não como substituto da correção.
3. `SIGINT`/`SIGTERM` fecham o servidor antes de sair (encerramento controlado) — diferença entre isso e `pm2 restart`/`reload`: o primeiro é acionado por um sinal externo com fechamento gracioso da conexão; `reload` (só em modo cluster) sobe uma instância nova antes de derrubar a antiga, sem downtime; `restart` derruba e sobe de novo, com uma janela sem servidor no ar.

**Como a correção foi validada** (evidência real, mesma app, mesmo
`ecosystem.config.js`, agora com o código corrigido):

`pid` permaneceu o mesmo (`75957`) antes e depois de duas chamadas a
`/crash`, e o contador de restarts ficou em `0`:
```
$ curl /crash  → {"ok":true,"aviso":"processamento em segundo plano iniciado"}
$ curl /crash  → {"ok":true,"aviso":"processamento em segundo plano iniciado"}

│ 0  │ api │ fork │ pid 75957 │ uptime 8s │ ↺ 0 │ online │
restarts: 0
unstable restarts: 0
```

`pm2 logs api` mostrou o erro sendo registrado pelo logger estruturado, sem
derrubar o processo:
```
2026-09-21T22:29:39.678Z [error] falha ao processar item da fila {"err":{"message":"falha ao processar a fila","stack":"Error: falha ao processar a fila\n    at Timeout._onTimeout..."}}
2026-09-21T22:29:40.685Z [error] falha ao processar item da fila {"err":{"message":"falha ao processar a fila","stack":"Error: falha ao processar a fila\n    at Timeout._onTimeout..."}}
```

**`ecosystem.config.js` utilizado:** ver [`ecosystem.config.js`](ecosystem.config.js)
— `script: 'dist/index.js'` (build prévio, sem `interpreter` ts-node),
`exec_mode: 'fork'`, `instances: 1` (estado em memória não pode ser
fragmentado entre workers), `max_restarts: 10` + `min_uptime: '10s'` (limite
para não mascarar um crash loop indefinidamente).

### Perguntas respondidas

- **fork vs cluster:** fork roda uma única instância do processo; cluster
  roda várias instâncias balanceadas atrás de um load balancer interno do
  PM2 (só funciona para apps stateless/sem estado em memória local, que não
  é o caso deste projeto).
- **Saída com código 0:** o PM2 não considera reinício automático (não é
  tratado como crash); com código diferente de 0 (como o `exit(1)` usado
  aqui), conta como falha e incrementa `restarts`.
- **Por que reinício automático pode esconder um defeito grave:** o serviço
  parece "no ar" nas métricas de disponibilidade enquanto perde estado e
  reprocessa do zero a cada crash — sem olhar `pm2 logs`/`↺`, ninguém percebe.
- **Local dos logs:** por padrão em `~/.pm2/logs/<app>-out-<id>.log` e
  `<app>-error-<id>.log` (ou sob `$PM2_HOME/logs`); pode ser customizado por
  app em `ecosystem.config.js` com `out_file`/`error_file`.
- **`restart` vs `reload` vs `delete`:** `restart` derruba e sobe de novo
  (janela sem servidor, único processo); `reload` só existe em modo cluster
  e sobe instâncias novas antes de tirar as antigas do ar (zero downtime);
  `delete` remove o processo da lista do PM2 (não apenas para).
- **Por que sair após um `uncaughtException` costuma ser mais seguro:** o
  estado do processo pode estar inconsistente no ponto em que a exceção
  ocorreu (memória parcialmente atualizada, listener em estado indefinido);
  continuar rodando arrisca corromper dados ou mascarar o problema — encerrar
  e deixar o PM2 subir um processo novo e limpo é mais previsível.
