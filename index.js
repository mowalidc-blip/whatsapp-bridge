const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pino = require('pino');

const app = express();
app.use(cors());
app.use(bodyParser.json());

let sock;
let qrCode = "";
let connectionStatus = "disconnected";

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            qrCode = qr;
            connectionStatus = "qr";
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            connectionStatus = "disconnected";
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('opened connection');
            connectionStatus = "connected";
            qrCode = "";
        }
    });
}

// Endpoint لجلب الـ QR كود
app.get('/instance/qr', (req, res) => {
    res.json({ qr: qrCode, status: connectionStatus });
});

// Endpoint لإرسال الرسائل
app.post('/messages/send', async (req, res) => {
    const { number, message } = req.body;
    try {
        if (connectionStatus !== "connected") {
            return res.status(400).json({ error: "WhatsApp not connected" });
        }
        const jid = `${number}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectToWhatsApp();
});
