const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// Conexión SQLite
// ==========================
const db = new sqlite3.Database('./tokens.db', (err) => {
  if (err) {
    console.error("❌ Error conectando a SQLite:", err.message);
  } else {
    console.log("✅ Conectado a SQLite");
  }
});

// Crear tabla si no existe
db.run(`
  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Funciones para guardar/consultar
const saveToken = (userId, token) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO tokens (user_id, token) 
       VALUES (?, ?) 
       ON CONFLICT(user_id) DO UPDATE 
       SET token = excluded.token, created_at = CURRENT_TIMESTAMP`,
      [userId, token],
      function (err) {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
};

const getToken = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT token FROM tokens WHERE user_id = ?`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// ==========================
// Servidor HTTP
// ==========================
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: { origin: '*' },
});

// Guardamos la instancia de io en la app
app.set('io', io);

/**
 * ==========================
 * Funciones de emisión
 * ==========================
 */
const emitChangesEvents = (userId, message) => {
  io.to(`user:${userId}`).emit('cambios_eventos', message);
};

const emitChangeAds = (userId, message) => {
  io.to(`user:${userId}`).emit('cambio_publicidad', message);
};

const emitNewMessage = (userId, message) => {
  io.to(`user:${userId}`).emit('new_message', message);
};

/**
 * ==========================
 * Socket.IO
 * ==========================
 */
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`🟢 Usuario conectado: ${socket.id}`);

  socket.on('register_user', async (userId , expoPushToken) => {
    socket.join(`user:${userId}`);
    onlineUsers.set(userId, socket.id);
    
    console.log(`✅ Usuario ${userId} está en línea con expo Push token = ${expoPushToken}` );

     // Guardar el token directamente en la base de datos
    if (expoPushToken) {
      try {
        await saveToken(userId, expoPushToken);
        console.log(`💾 Token guardado en DB para usuario ${userId}`);
      } catch (err) {
        console.error(`❌ Error guardando token para ${userId}:`, err.message);
      }
    }

  }); 

  socket.on('disconnect', () => {
    for (let [userId, id] of onlineUsers) {
      if (id === socket.id) {
        onlineUsers.delete(userId);
        console.log(`🔴 Usuario desconectado: ${userId}`);
      }
    }
  });
});

/**
 * ==========================
 * Rutas HTTP
 * ==========================
 */
app.get('/', (req, res) => {
  res.send('Servidor WebSocket funcionando ✔️');
});

// Guardar token
app.post('/save-token', async (req, res) => {
  const { user_id, token } = req.body;
  if (!user_id || !token) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  try {
    await saveToken(user_id, token);
    console.log(`💾 Token guardado para usuario ${user_id}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Error guardando token:", err.message);
    return res.status(500).json({ error: 'Error guardando token' });
  }
});

// Consultar token
app.get('/get-token/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await getToken(user_id);
    if (!result) return res.status(404).json({ error: 'Token no encontrado' });
    return res.json({ user_id, token: result.token });
  } catch (err) {
    console.error("❌ Error obteniendo token:", err.message);
    return res.status(500).json({ error: 'Error al consultar token' });
  }
});

// Emitir evento ejemplo
app.post('/mensajes', (req, res) => {
  const { id_remitente, id_destinatario, chat_id, contenido } = req.body;
  const nuevoMensaje = {
    id_mensaje: Date.now(),
    id_remitente,
    id_destinatario,
    chat_id,
    contenido,
    timestamp: new Date(),
  };

  emitNewMessage(id_destinatario, nuevoMensaje);

  console.log(`📤 Mensaje enviado de ${id_remitente} a ${id_destinatario} en chat:${chat_id}`);
  return res.status(200).json({ success: true, data: nuevoMensaje });
});

// Iniciar el servidor
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
