const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();

// ==========================
// Inicialización Express
// ==========================
const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// Conexión SQLite
// ==========================
const db = new sqlite3.Database("./tokens.db", (err) => {
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

// Guardar token
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

// Obtener token
const getToken = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT token FROM tokens WHERE user_id = ?`, [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// ==========================
// Servidor HTTP + Socket.IO
// ==========================
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Usuarios en línea
const onlineUsers = new Map();

// ==========================
// Funciones de emisión
// ==========================
const emitNewMessage = (userId, message) => {
  io.to(`user:${userId}`).emit("nuevo_mensaje", message);
};

// ==========================
// WebSockets
// ==========================
io.on("connection", (socket) => {
  console.log(`🟢 Usuario conectado: ${socket.id}`);

  // Registrar usuario + token
  socket.on("register_user", async ({ userId, expoPushToken }) => {
    socket.join(`user:${userId}`);
    onlineUsers.set(userId, socket.id);

    console.log(`✅ Usuario ${userId} registrado con socket ${socket.id}`);

    // Guardar token en DB
    if (expoPushToken) {
      try {
        await saveToken(userId, expoPushToken);
        console.log(`💾 Token guardado en DB para usuario ${userId}`);
      } catch (err) {
        console.error(`❌ Error guardando token para ${userId}:`, err.message);
      }
    }
  });

  // Enviar mensaje a usuario específico
  socket.on('enviar_mensaje', ({ id_remitente, id_destinatario, contenido }) => {
  const nuevoMensaje = {
    id_mensaje: Date.now(),
    id_remitente,
    id_destinatario,
    contenido,
    timestamp: new Date(),
  };

  // ✅ Solo el destinatario lo recibe
  io.to(`user:${id_destinatario}`).emit('nuevo_mensaje', nuevoMensaje);
});

  // Desconexión
  socket.on("disconnect", () => {
    for (let [userId, id] of onlineUsers) {
      if (id === socket.id) {
        onlineUsers.delete(userId);
        console.log(`🔴 Usuario desconectado: ${userId}`);
      }
    }
  });
});

// ==========================
// Rutas HTTP para pruebas
// ==========================

// Guardar token manualmente
app.post("/save-token", async (req, res) => {
  const { user_id, token } = req.body;
  if (!user_id || !token) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  try {
    await saveToken(user_id, token);
    console.log(`💾 Token guardado para usuario ${user_id}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Error guardando token:", err.message);
    return res.status(500).json({ error: "Error guardando token" });
  }
});

// Consultar token
app.get("/get-token/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await getToken(user_id);
    if (!result) return res.status(404).json({ error: "Token no encontrado" });
    return res.json({ user_id, token: result.token });
  } catch (err) {
    console.error("❌ Error obteniendo token:", err.message);
    return res.status(500).json({ error: "Error al consultar token" });
  }
});

// Enviar mensaje vía HTTP (Postman)
app.post("/test_sockets", (req, res) => {
  const { id_remitente, id_destinatario, contenido } = req.body;
  if (!id_remitente || !id_destinatario || !contenido) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  const nuevoMensaje = {
    id: Date.now(),
    id_remitente,
    id_destinatario,
    contenido,
    timestamp: new Date(),
  };

  emitNewMessage(id_destinatario, nuevoMensaje);

  console.log(`📤 Mensaje enviado de ${id_remitente} → ${id_destinatario}: ${contenido}`);
  return res.status(200).json({ success: true, data: nuevoMensaje });
});

// ==========================
// Iniciar servidor
// ==========================
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
