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
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ reply: "Missing message or sessionId" });
    }

    console.log(`Incoming message from session ${sessionId}:`, message);

    // ✅ Save user message
    await saveMessage(sessionId, "user", message);

    // ✅ Get last 20 messages from conversation
    const history = await getConversation(sessionId, 20);
    console.log(`Conversation history for session ${sessionId}:`, history);

    // Build messages for OpenAI
    const messages = [
      {
        role: "system",
        content: `
You are "GenScore", a warm, caring mental health chatbot.
You speak naturally in English or Nigerian Pidgin depending on the user’s message.
- Be empathetic and supportive
- Avoid clinical or diagnostic advice
- Encourage healthy coping mechanisms (rest, talking to friends, journaling, etc.)
- If the user sounds very distressed, gently suggest professional help
- Keep replies short, conversational, and human-like
- Never suggest medication or substances

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

    // ✅ Call OpenAI Chat API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    console.log("OpenAI API response:", data);

    const botReply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I dey here for you. Tell me how your mind dey today.";

    // ✅ Save bot reply
    await saveMessage(sessionId, "assistant", botReply);

    console.log(`Bot reply for session ${sessionId}:`, botReply);

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

