import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;

export async function initDb() {
  db = await open({
    filename: './chatbot.sqlite',
    driver: sqlite3.Database
  });

  await db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      role TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function saveMessage(sessionId, role, content) {
  await db.run(
    `INSERT INTO conversations (session_id, role, content) VALUES (?, ?, ?)`,
    [sessionId, role, content]
  );
}

export async function getConversation(sessionId, limit = 10) {
  return await db.all(
    `SELECT role, content FROM conversations WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`,
    [sessionId, limit]
  );
}
