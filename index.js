const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config();
const OpenAI = require("openai").default;
const { createClient } = require('@supabase/supabase-js');
const { createTask, updateTask, deleteTask, getAllTasks } = require('./services/todoist');

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
  const token = req.headers['authorization'];
  if (!token || token !== `Bearer ${process.env.AGENT_SECRET}`) {
    return res.status(403).json({ error: "Acesso não autorizado" });
  }
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
          content: `Você é o assistente pessoal inteligente do Lucas Cardozo. Seu papel é ajudar a organizar sua vida, entender comandos curtos e responder sempre com um JSON estruturado, sem explicações adicionais.

Seu objetivo principal é interpretar a intenção de Lucas com clareza, classificar o tipo de ação e indicar para qual app a ação deve ser executada.

Sempre responda no formato abaixo:

{
  "action": "criar" | "buscar",
  "app": "todoist" | "supabase" | "notion" | "gmail" | "slack",
  "tipo": "task" | "evento" | "nota" | "mensagem",
  "title": "Título ou conteúdo principal",
  "due_date": "Data e hora no formato ISO 8601 (ex: 2025-04-21T14:00)",
  "data": "Data ou intervalo de interesse para buscas (ex: 'hoje', 'próxima semana')"
}

Regras:
- Use "app": "todoist" para tarefas reais (criar ou consultar tarefas do Todoist).
- Use "app": "supabase" apenas para recuperar histórico de mensagens, contextos e interações anteriores com você mesmo.
- Se o comando for apenas informativo ou não envolver nenhuma ação, ainda assim responda com o JSON e use "action": "buscar" com "app": "supabase" e "tipo": "mensagem".
- Nunca invente dados. Se algo estiver faltando, use campos vazios mas mantenha a estrutura JSON.

Exemplo:
Entrada:
"Tenho algo pra amanhã?"

Resposta:
{
  "action": "buscar",
  "app": "todoist",
  "tipo": "task",
  "title": "",
  "due_date": "2025-04-21T00:00",
  "data": "amanhã"
}`,
        },
        { role: "user", content: input },
      ],
    });

    const resposta = (completion?.choices?.[0]?.message?.content || "").trim();
    let jsonFormatado = null;

    try {
      jsonFormatado = JSON.parse(resposta);
    } catch (e) {
      return res.status(400).json({
        status: "error",
        error: "Resposta do GPT não é um JSON válido.",
        raw: resposta
      });
    }

    const { tipo, app, title, due_date } = jsonFormatado;

    if (!tipo || !app || !title || !due_date) {
      return res.status(400).json({
        status: "error",
        error: "JSON retornado está incompleto. Esperado: tipo, app, title, due_date.",
        raw: jsonFormatado
      });
    }

    await supabase.from('entries').insert([
      {
        input,
        response: JSON.stringify(jsonFormatado)
      }
    ]);

    // Executa ação se for uma criação no Todoist
    if (jsonFormatado.app === "todoist" && jsonFormatado.action === "criar" && jsonFormatado.tipo === "task") {
      try {
        const resultadoTodoist = await createTask({
          title: jsonFormatado.title,
          dueDate: jsonFormatado.due_date
        });

        const formattedMessage = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `Você é o assistente pessoal do Lucas. Sua tarefa é transformar a resposta de uma API em uma mensagem clara, útil e amigável em português. Use um tom direto, informal e humano. Se houver links, destaque com [ver mais](link). Use Markdown com moderação e emojis apenas quando fizer sentido. Resuma as informações importantes sem repetir campos técnicos.`
            },
            {
              role: "user",
              content: `Essa foi a resposta da API:\n${JSON.stringify(resultadoTodoist)}`
            }
          ],
          temperature: 0.7
        });

        const pretty = formattedMessage.choices[0]?.message?.content || "";

        return res.status(200).json({
          received: input,
          response: jsonFormatado,
          todoist: resultadoTodoist,
          message: pretty
        });
      } catch (e) {
        return res.status(500).json({
          status: "error",
          error: "Erro ao enviar tarefa para o Todoist.",
          details: e.message
        });
      }
    }

    res.status(200).json({
      received: input,
      response: jsonFormatado
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


// Endpoint para listar todas as tarefas do Todoist
app.get("/tasks", async (req, res) => {
  const token = req.headers['authorization'];
  if (!token || token !== `Bearer ${process.env.AGENT_SECRET}`) {
    return res.status(403).json({ error: "Acesso não autorizado" });
  }
  try {
    const tarefas = await getAllTasks();
    res.json({ tarefas });
  } catch (e) {
    res.status(500).json({
      status: "error",
      error: "Erro ao buscar tarefas no Todoist.",
      details: e.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
