# Exercícios 4, 5 e 6 — Logs, Middleware e PM2

## Rodar (exercícios 4 e 5)

```
npm install
npm run dev
```

Sobe em `http://localhost:3000`.

Rotas: `/health`, `/usuarios/:id`, `/erro`, `/lento`, `/pedidos/1`, `/pedidos/999`, `/crash`.

Nível de log: `LOG_LEVEL=error npm run dev`

## Rodar (exercício 6, PM2)

```
npm run build
npx pm2 start ecosystem.config.js
npx pm2 list
npx pm2 logs api
npx pm2 delete api
```

## Registro

As respostas de cada exercício (sintoma, hipótese, evidência, correção) estão em [REGISTRO.md](REGISTRO.md).
