const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

// Servidor HTTP
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
  },
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

const onlineUsers = new Map(); // key: userId, value: socket.id

io.on('connection', (socket) => {
  console.log(`🟢 Usuario conectado: ${socket.id}`);

  // Registro del usuario en su sala personal
  socket.on('register_user', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`✅ Usuario ${userId} se unió a sala user:${userId}`);
    onlineUsers.set(userId, socket.id);
    console.log(`✅ Usuario ${userId} está en línea`);
  });

  // Unirse a una sala de chat
  socket.on('join_chat', (chatId) => {
    socket.join(`chat:${chatId}`);
    console.log(`👥 Se unió a chat:${chatId}`);
  });

  // Salir de una sala de chat
  socket.on('leave_chat', (chatId) => {
    socket.leave(`chat:${chatId}`);
    console.log(`👤 Salió de chat:${chatId}`);
  });

  socket.on('disconnect', () => {

     // remover usuario del mapa de usuarios en línea
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

app.post('/emitir-cambios-eventos', (req, res) => {
  const { id_destinatario, nuevoMensaje } = req.body;
  if (!id_destinatario || !nuevoMensaje)
    return res.status(400).json({ error: 'Faltan parámetros' });

  emitChangesEvents(id_destinatario, nuevoMensaje);
  return res.json({ status: 'ok', message: 'Evento cambios_eventos emitido' });
});

app.post('/emitir-cambio-publicidad', (req, res) => {
  const { id_destinatario, nuevoMensaje } = req.body;
  if (!id_destinatario || !nuevoMensaje)
    return res.status(400).json({ error: 'Faltan parámetros' });

  emitChangeAds(id_destinatario, nuevoMensaje);
  return res.json({ status: 'ok', message: 'Evento cambio_publicidad emitido' });
});

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
