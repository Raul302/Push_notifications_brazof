const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const fetch = require('node-fetch'); // npm install node-fetch@2

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



  // Función para enviar notificación push usando Expo
const sendPushNotification = async (expoPushToken, message) => {
  try {
    const payload = [
      {
        to: expoPushToken,
        sound: 'default',
        title: 'has recibido un nuevo mensaje',
        body: message,
        data: { message },
        android: {
          icon: '/assets/logowithouthbrackground.png',
        color: '#1FFF62',  // verde, por ejemplo
      },
      },
    ];

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('🔔 Push notification result:', result);
  } catch (err) {
    console.error('❌ Error enviando push notification:', err.message);
  }
};



  // Enviar mensaje a usuario específico
  socket.on('enviar_mensaje', async({ id_remitente, id_destinatario, contenido }) => {
  const nuevoMensaje = {
    id_mensaje: Date.now(),
    id_remitente,
    id_destinatario,
    contenido,
    timestamp: new Date(),
  };

  // Si el usuario esta en linea , notificar por websocket , de lo contrario via PUSH NOTIFICATIONS

    const estaEnLinea = onlineUsers.has(id_destinatario);
    
     if (estaEnLinea) {
    // Usuario online → WebSocket
    io.to(`user:${id_destinatario}`).emit('nuevo_mensaje', nuevoMensaje);
    console.log(`📤 Mensaje en tiempo real a: ${id_destinatario}`);
  } else {
    // Usuario offline → enviar push
    try {
      const tokenRow = await getToken(id_destinatario);
      if (tokenRow) {
        console.log(`🔔 Usuario offline, enviando push a: ${id_destinatario}`);
        await sendPushNotification(tokenRow.token, contenido);
      } else {
        console.log(`⚠️ Usuario offline y sin token: ${id_destinatario}`);
      }
    } catch (err) {
      console.error('❌ Error al enviar push al usuario offline:', err.message);
    }
  }

  // ✅ Solo el destinatario lo recibe
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


  // HTTP endpoint para emitir cambios_eventos
app.post('/emitir-cambios-eventos', async (req, res) => {
  const { id_destinatario } = req.body;

   const estaEnLinea = onlineUsers.has(id_destinatario);

   const mensaje = ' Ha habido cambios en tu evento ';
    
     if (estaEnLinea) {
    // Usuario online → WebSocket
  io.to(`user:${id_destinatario}`).emit('cambios_eventos', mensaje);
    console.log(`📤 Mensaje en tiempo real a: ${id_destinatario}`);
  } else {
    // Usuario offline → enviar push
    try {
      const tokenRow = await getToken(id_destinatario);
      if (tokenRow) {
        console.log(`🔔 Usuario offline, enviando push a: ${id_destinatario}`);
        await sendPushNotification(tokenRow.token, mensaje);
      } else {
        console.log(`⚠️ Usuario offline y sin token: ${id_destinatario}`);
      }
    } catch (err) {
      console.error('❌ Error al enviar push al usuario offline:', err.message);
    }
  }

  return res.json({ status: 'ok', message: 'Evento cambios_eventos emitido' });
});


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
