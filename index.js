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

// Guardamos la instancia de io en la app para usarla en rutas
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🟢 Usuario conectado: ${socket.id}`);

  // Registro del usuario en su sala personal
  socket.on('register_user', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`✅ Usuario ${userId} se unió a sala user:${userId}`);
  });

  // Unirse a una sala de chat
  socket.on('join_chat', (chatId) => {
    socket.join(`chat:${chatId}`);
    console.log(`👥 Se unió a chat:${chatId}`);
  });

  // Salir de una sala de chat (opcional)
  socket.on('leave_chat', (chatId) => {
    socket.leave(`chat:${chatId}`);
    console.log(`👤 Salió de chat:${chatId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Usuario desconectado: ${socket.id}`);
  });
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor WebSocket funcionando ✔️');
});


 // Evento para enviar mensaje
  socket.on('send_message', ({ chatId, id_destinatario, contenido }) => {
    const mensaje = {
      id_mensaje: Date.now(),
      chatId,
      contenido,
      timestamp: new Date(),
    };

    // Emitir a todos en el chat
      io.to(`user:${id_destinatario}`).emit('nuevo_mensaje', nuevoMensaje);
    console.log(`📤 Mensaje enviado en chat:${chatId} al usuario:${id_destinatario}`);
  });


  
  
  // HTTP endpoint para emitir cambios_eventos
app.post('/emitir-cambios-eventos', (req, res) => {
  const { id_destinatario , nuevoMensaje } = req.body;

  if (!id_destinatario || !nuevoMensaje) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  io.to(`user:${id_destinatario}`).emit('cambios_eventos', nuevoMensaje);
  return res.json({ status: 'ok', message: 'Evento cambios_eventos emitido' });
});



// HTTP endpoint para emitir cambio_publicidad
app.post('/emitir-cambio-publicidad', (req, res) => {
  const { id_destinatario , nuevoMensaje } = req.body;

  if (!id_destinatario || !nuevoMensaje) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  io.to(`user:${id_destinatario}`).emit('cambio_publicidad', nuevoMensaje);
  return res.json({ status: 'ok', message: 'Evento cambio_publicidad emitido' });
});

// Ruta para enviar mensajes
app.post('/mensajes', (req, res) => {
  const { id_remitente, id_destinatario, chat_id, contenido } = req.body;

  const nuevoMensaje = {
    id_mensaje: Date.now(),
    id_remitente,
    id_destinatario,
    chat_id,
    contenido,
    timestamp: new Date()
  };


// Evento para emitir solo "cambios_eventos"
socket.on('emitir_cambios_eventos', ({ id_destinatario, nuevoMensaje }) => {
  io.to(`user:${id_destinatario}`).emit('cambios_eventos', nuevoMensaje);
});

// Evento para emitir solo "cambio_publicidad"
socket.on('emitir_cambio_publicidad', ({ id_destinatario, nuevoMensaje }) => {
  io.to(`user:${id_destinatario}`).emit('cambio_publicidad', nuevoMensaje);
});

  // Emitir a la sala del chat
  io.to(`chat:${chat_id}`).emit(`chat:${chat_id}`, nuevoMensaje);

  // Emitir al usuario destinatario aunque no esté en ese chat activo
  io.to(`user:${id_destinatario}`).emit('nuevo_mensaje', nuevoMensaje);

    // Emitir al usuario destinatario aunque no esté en ese chat activo
  io.to(`user:${id_destinatario}`).emit('cambios_eventos', nuevoMensaje);

  io.to(`user:${id_destinatario}`).emit('cambio_publicidad', nuevoMensaje);


  console.log(`📤 Mensaje enviado de ${id_remitente} a ${id_destinatario} en chat:${chat_id}`);

  return res.status(200).json({ success: true, data: nuevoMensaje });
});

// Iniciar el servidor
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
