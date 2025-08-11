const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// --- Base de datos ---
const db = new sqlite3.Database('./tokens.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      expo_token TEXT NOT NULL
    )
  `);
});

// --- Ruta para registrar el token ---
app.post('/register-token', (req, res) => {
  const { user_id, expo_token } = req.body;

  if (!user_id || !expo_token) {
    return res.status(400).json({ error: 'user_id y expo_token son requeridos.' });
  }

  const query = `
    INSERT INTO push_tokens (user_id, expo_token)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET expo_token=excluded.expo_token;
  `;

  db.run(query, [user_id, expo_token], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Token registrado correctamente.' });
  });
});

// --- Ruta para enviar una notificación ---
app.post('/send-message-notification', async (req, res) => {
  const { user_id, title, body, data } = req.body;

  if (!user_id || !title || !body) {
    return res.status(400).json({ error: 'user_id, title y body son requeridos.' });
  }

  db.get(
    'SELECT expo_token FROM push_tokens WHERE user_id = ?',
    [user_id],
    async (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Token no encontrado para este usuario.' });
      }

      try {
        const response = await axios.post('https://exp.host/--/api/v2/push/send', {
          to: row.expo_token,
          title,
          body,
          data: data || {},
        });

        res.json({ message: 'Notificación enviada.', expo_response: response.data });
      } catch (error) {
        res.status(500).json({ error: 'Error al enviar notificación', details: error.message });
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`✅ Push Notification Service corriendo en http://localhost:${PORT}`);
});
