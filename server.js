import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, saveMessage, getConversation } from "./db.js";
import OpenAI from "openai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const OPENAI_API_KEY = process.env.OPENAI_API_KEY; 

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "your-secret-key",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 600000 } // 10 minutes
}));

// Initialize SQLite DB
await initDb();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  try {
    // ✅ Fetch past conversation from DB
    const history = await getConversation(sessionId);
    const messages = [
      {
        role: "system",
        content: `
You are "GenScore", a warm, caring mental health support chatbot.
You speak in a natural, compassionate tone — using English or Nigerian Pidgin based on the user’s message.
If the user writes in Pidgin, respond naturally in Pidgin.
If they write in English, reply in clear, simple English.

Guidelines:
- Always be empathetic and supportive.
- Avoid clinical or diagnostic language.
- Encourage healthy coping methods (like rest, talking to friends, breathing, journaling, etc.).
- If someone sounds very distressed, gently suggest they talk to a mental health professional or trusted person.
- Keep your replies short, human-like, and conversational.
- Never suggest or discuss medication or substances.

Example:
User: I dey feel somehow for body.
Bot: Sorry to hear say you no too dey okay. You wan gist small make you calm down?

User: I feel really low today.
Bot: That sounds really hard. I’m here to listen — do you want to talk more about what’s making you feel this way?
        `,
      },
      ...history.map((msg) => ({
        role: msg.role.toLowerCase() === "user" ? "user" : "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    // ✅ Call OpenAI Chat Completion API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.8, // slightly more expressive
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    const botReply =
      data.choices?.[0]?.message?.content?.trim() ||
      "I dey here for you. Tell me how your mind dey today.";

    // ✅ Save both user and bot messages
    await saveMessage(sessionId, "User", message);
    await saveMessage(sessionId, "Bot", botReply);

    res.json({ reply: botReply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({
      reply: "Sorry, e be like say something don go wrong. Make we try again soon.",
    });
  }
});

// Serve frontend for all routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () =>
  console.log(`✅ GenScore Chatbot running on port ${port}`)
);

