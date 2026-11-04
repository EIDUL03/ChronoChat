const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const path = require('path');

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

const pendingVerifications = {};
const users = {}; 

io.on('connection', (socket) => {
    console.log('User connected: ', socket.id);

    socket.on('request_verification', (email, callback) => {
        if (!email || !email.includes('@')) {
            return callback({ success: false, message: 'Invalid email address' });
        }
        
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        pendingVerifications[email] = otp;

        console.log(`\n========================================`);
        console.log(`📧 [EMAIL SERVICE] Verification Code for ${email}: ${otp}`);
        console.log(`========================================\n`);

        callback({ success: true, message: 'Verification code sent to your email.' });
    });

    socket.on('verify_and_register', ({ email, otp }, callback) => {
        if (pendingVerifications[email] === otp) {
            const code = Math.floor(10000000 + Math.random() * 90000000).toString();
            users[code] = { email, socketId: socket.id };
            delete pendingVerifications[email];

            console.log(`Successfully Registered: ${email} -> 8-Digit Code: ${code}`);
            callback({ success: true, code: code });
        } else {
            callback({ success: false, message: 'Incorrect verification code. Check your server console!' });
        }
    });

    socket.on('send_message', ({ targetCode, message, messageId, senderCode }) => {
        const targetUser = users[targetCode];
        if (targetUser) {
            io.to(targetUser.socketId).emit('receive_message', { senderCode, message, messageId });
        }
    });

    socket.on('delete_message_everyone', ({ targetCode, messageId, senderCode }) => {
        const targetUser = users[targetCode];
        if (targetUser) {
            io.to(targetUser.socketId).emit('message_deleted_everyone', { senderCode, messageId });
        }
    });

    socket.on('delete_contact_entirely', ({ targetCode, senderCode }) => {
        const targetUser = users[targetCode];
        if (targetUser) {
            io.to(targetUser.socketId).emit('contact_deleted_entirely', { senderCode });
        }
    });

    // WebRTC Call Relay
    socket.on('call_user', ({ targetCode, offer, callerCode }) => {
        const targetUser = users[targetCode];
        if (targetUser) {
            io.to(targetUser.socketId).emit('incoming_call', { offer, callerCode });
        }
    });

    socket.on('answer_call', ({ targetCode, answer }) => {
        const targetUser = users[targetCode];
        if (targetUser) {
            io.to(targetUser.socketId).emit('call_answered', { answer });
        }
    });

    socket.on('ice_candidate', ({ targetCode, candidate }) => {
        const targetUser = users[targetCode];
        if (targetUser) {
            io.to(targetUser.socketId).emit('ice_candidate', { candidate });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (let code in users) {
            if (users[code].socketId === socket.id) {
                delete users[code];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});