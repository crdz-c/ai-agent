const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const OpenAI = require("openai").default;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Endpoint principal
app.post("/agent", async (req, res) => {
  const input = req.body.input;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Você é o assistente pessoal do Lucas. Seu trabalho é entender comandos curtos, classificar como tarefa, evento, e-mail ou nota, e retornar um JSON estruturado. Exemplo de retorno:
{
  "tipo": "task",
  "app": "todoist",
  "title": "Responder o cliente X",
  "due_date": "2025-04-17T10:00"
}`,
        },
        { role: "user", content: input },
      ],
    });

    const resposta = completion?.choices?.[0]?.message?.content || "Sem resposta do GPT.";

    res.json({
      status: "ok",
      received: input,
      response: resposta
    });

  } catch (error) {
    console.error("Erro com o GPT:", error?.response?.data || error.message || error);
    res.status(500).json({
      status: "error",
      error: "Falha ao processar a resposta do GPT."
    });
  }
});

// Teste GET
app.get("/", (req, res) => {
  res.send("👋 AI Agent Online!");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
