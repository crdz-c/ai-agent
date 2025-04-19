const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config();
const OpenAI = require("openai").default;
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
  if (!input || typeof input !== 'string') {
    return res.status(400).json({
      status: "error",
      error: "Requisição malformada: o campo 'input' deve ser uma string válida."
    });
  }

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

    const resposta = completion?.choices?.[0]?.message?.content?.trim() || "Sem resposta gerada.";
    
    await supabase.from('entries').insert([
      {
        input,
        response: resposta
      }
    ]);

    res.status(200).json({
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

// Endpoint de diagnóstico rápido
app.post("/debug", (req, res) => {
  res.json({
    received: req.body
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
