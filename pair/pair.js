const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
const pino = require("pino");
const router = express.Router();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

const { upload } = require('../server/mega');
const { encodeFileToBase64 } = require('../server/base64');
const saveCredsYmd = require('../server/ymd-sessiondb');
const config = require("../config");
const sendMessage = config.SESSION_MESSAGE;
const { saveNumber, isNumberAllowed } = require('../server/db');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

async function YasiyaPair(res, num) {
    const { state, saveCreds } = await useMultiFileAuthState(`./session_pair`);
    try {
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: Browsers.windows("Chrome"),
        });

        if (!sock.authState.creds.registered) {
            await delay(1500);
            num = num ? num.replace(/[^0-9]/g, '') : '';
            const code = await sock.requestPairingCode(num);

            if (res && !res.headersSent) {
                await res.send({ code });
            }
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on("connection.update", async (s) => {
            const { connection, lastDisconnect } = s;

            if (connection === "open") {
                try {
                    
                    await delay(10000);
                    const user_jid = jidNormalizedUser(sock.user.id);
                    const sessionPath = './session_pair/creds.json';

                    // Send creds.json file
                    const credsDoc = await sock.sendMessage(user_jid, {
                        document: fs.readFileSync(sessionPath),
                        mimetype: `application/json`,
                        fileName: `creds.json`
                    });

                    // Send base64 encode
                    const base64Id = encodeFileToBase64(sessionPath);
                    await sock.sendMessage(user_jid, {
                        text: config.BASE64_START + base64Id
                    });

                    // Send YMD Session db id
                    const ymdses = await saveCredsYmd(sessionPath)
                    await sock.sendMessage(user_jid, {
                        text: config.YMDDB_START + ymdses
                    });

                    // Send mega.nz url
                    let mega_url = await upload(fs.createReadStream(sessionPath), `${user_jid}.json`);
                    if(mega_url && mega_url.includes('https://mega.nz/file/')) mega_url = mega_url.replace('https://mega.nz/file/', '');
                    const sid = config.MEGA_START + mega_url;
                    await sock.sendMessage(user_jid, {
                        text: sid
                    });

                    // Send post
                    await sock.sendMessage(user_jid, {
                        text: sendMessage
                    });

                    await delay(300);
                    await sock.ws.close();
                    removeFile('./session_pair');
                    process.exit(0);

                } catch (e) {
                    console.error("Error during post-pairing process:", e);
                    exec('pm2 restart yasiya-md');
                }
            }

            if (
                connection === "close" &&
                lastDisconnect &&
                lastDisconnect.error &&
                lastDisconnect.error.output.statusCode !== 401
            ) {
                console.log("Reconnecting due to disconnection...");
                await delay(10000);
                await YasiyaPair(); // auto-reconnect
            }
        });

    } catch (err) {
        console.error("Error in YasiyaPair:", err);
        exec('pm2 restart yasiya-md');

        if (res && !res.headersSent) {
            res.send({ code: "Service Unavailable" });
        }
    }
}

// HTTP Route
router.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: 'number query param is required' });

    const allowed = await isNumberAllowed(num);
    if (!allowed) return res.status(429).send({ error: 'Try again after 5 minutes.' });

    await saveNumber(num); // Save or update timestamp
    await YasiyaPair(res, num);
});

// Global Error Handling
process.on('uncaughtException', function (err) {
    console.error('Caught exception:', err);
    exec('pm2 restart yasiya-md');
});

// Restart every 10 minutes
setInterval(() => {
    console.log('⏱ Restarting every 10 minutes...');
    exec('pm2 restart yasiya-md', (err, stdout, stderr) => {
        if (err) {
            console.error('Error restarting server:', stderr);
        } else {
            console.log('✅ Server restarted successfully');
        }
    });
}, 10 * 60 * 1000); // 600000 ms

module.exports = router;


