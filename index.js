// index.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Endpoint principal
app.post("/agent", async (req, res) => {
  const input = req.body.input;
  console.log("Recebido:", input);

  // Aqui vamos futuramente chamar o GPT e retornar a ação classificada.
  return res.json({ status: "ok", received: input });
});

// Teste GET
app.get("/", (req, res) => {
  res.send("👋 AI Agent Online!");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});