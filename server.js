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

    // Save user message
    await saveMessage(sessionId, "user", message);

    // Get last 20 messages from history
    const history = await getConversation(sessionId, 20);

    const messages = [
      {
        role: "system",
        content: `You are a compassionate mental health chatbot. 
Respond with empathy, positivity, and understanding. 
Do NOT offer medical diagnoses or treatment. 
Encourage seeking professional help when needed.`
      },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 200,
      temperature: 0.7,
    });

    const botReply = completion.choices[0].message.content.trim();

    // Save bot reply
    await saveMessage(sessionId, "assistant", botReply);

    res.json({ reply: botReply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ reply: "Sorry, something went wrong." });
  }
});

// Serve frontend for all routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () =>
  console.log(`✅ MindEase Chatbot running on port ${port}`)
);

console.log("✅ OpenAI key loaded?", !!process.env.OPENAI_API_KEY);

