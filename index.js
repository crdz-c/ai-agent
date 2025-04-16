const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const configuration = new Configuration({
  apiKey: "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",
});
const openai = new OpenAIApi(configuration);

// Endpoint principal
app.post("/agent", async (req, res) => {
  const input = req.body.input;

  try {
    const completion = await openai.createChatCompletion({
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

    const resposta = completion.data.choices[0].message;
    res.json({ status: "ok", received: input, resposta });
  } catch (error) {
    console.error("Erro com o GPT:", error);
    res.status(500).json({ error: "Erro ao processar o comando com o GPT" });
  }
});

// Teste GET
app.get("/", (req, res) => {
  res.send("👋 AI Agent Online!");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
