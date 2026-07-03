const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(cors());
app.use(express.json());

let sock;
let qrCode = "";
let pairingCode = "";
let connectionStatus = "disconnected";

const PORT = process.env.PORT || 7860;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`);
    startWhatsApp().catch(err => console.log("WA Start Error:", err));
});

app.get('/', (req, res) => {
    res.send(`<h1>TAG WhatsApp Server is Ready! ✅</h1><p>Connection Status: <b>${connectionStatus}</b></p>`);
});

app.get('/instance/qr', (req, res) => {
    res.json({ qr: qrCode, pairingCode: pairingCode, status: connectionStatus });
});

// مسار طلب كود الربط برقم التليفون
app.post('/instance/pairing-code', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required" });
    if (connectionStatus === "connected") return res.json({ status: "connected" });

    try {
        // تنظيف الرقم من أي علامات
        const cleanPhone = phone.replace(/\D/g, '');
        const code = await sock.requestPairingCode(cleanPhone);
        pairingCode = code;
        res.json({ code });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/messages/send', async (req, res) => {
    const { number, message } = req.body;
    if (connectionStatus !== "connected") return res.status(400).json({ error: "WhatsApp not connected" });
    try {
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('session_auth_data');
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["TAG Barbershop", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrCode = qr;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            connectionStatus = "disconnected";
            qrCode = "";
            pairingCode = "";
            if (shouldReconnect) startWhatsApp();
        } else if (connection === 'open') {
            console.log('WhatsApp Connected! ✅');
            connectionStatus = "connected";
            qrCode = "";
            pairingCode = "";
        }
    });
}
