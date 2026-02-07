// ===============================
//        BASIC SETUP
// ===============================
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const chalk = require("chalk");
const TelegramBot = require("node-telegram-bot-api");
const moment = require("moment-timezone");

const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const { TELEGRAM_TOKEN } = require("./token");

// ===============================
//        TELEGRAM BOT
// ===============================
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ===============================
//    SASUKE HOT-UPDATE HANDLER
// ===============================
const updateSASUKE = () => {
    console.log(chalk.red.bold("🔄 SASUKE logic updated — system refresh initiated 🌑"));
    try {
        const sasukeModule = require.resolve("./sasuke");
        delete require.cache[sasukeModule];
        require("./sasuke");
        console.log(chalk.green.bold("✅ SASUKE logic reloaded successfully"));
    } catch (err) {
        console.error(chalk.red("❌ Failed to reload SASUKE logic:"), err);
    }
};

// Watch for changes in sasuke.js
fs.watchFile(path.join(__dirname, "sasuke.js"), { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
        console.log(chalk.hex("#ff4757").bold("🌀 Detected sasuke.js update"));
        updateSASUKE();
    }
});

// ===============================
//        GLOBAL STATE
// ===============================
const connectedUsers = {};
const USERS_FILE = "./connectedUsers.json";
if (fs.existsSync(USERS_FILE)) {
    Object.assign(connectedUsers, JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")));
}

// ===============================
//        TELEGRAM COMMANDS
// ===============================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const caption = `
🌑 *⧼ SASUKE–UCHIHA ⧽* 🌑
━━━━━━━━━━━━━━━
👋 Welcome to the Uchiha Clan archives.

I am *⧼ SASUKE–MD ⧽*, the ultimate pairing assistant. 
My Sharingan ensures your session is secure.

👁️ *Clan Services:*
➤ Secure WhatsApp Pairing 🔐
➤ Persistence & Session Recovery 🌙
➤ Fast Connection Speed ⚡

━━━━━━━━━━━━━━━
📌 *Commands*
✨ /pair <number>
✨ /mybots
✨ /uptime
📱 *Example:* /pair 8801719741293

🌸 *I am watching over your destiny.*
━━━━━━━━━━━━━━━
`;

    try {
        // Using your specified video link for the start message
        await bot.sendVideo(chatId, "https://files.catbox.moe/lz33ee.jpg", {
            caption,
            parse_mode: "Markdown"
        });
    } catch (err) {
        await bot.sendMessage(chatId, caption, { parse_mode: "Markdown" });
    }
});

bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    let phoneNumber = match[1].replace(/\D/g, "");
    if (!phoneNumber || phoneNumber.length < 10) return bot.sendMessage(chatId, "❌ Invalid number.");
    bot.sendMessage(chatId, `⏳ *Sasuke* is generating your pairing code for +${phoneNumber}...`);
    startWhatsAppBot(phoneNumber, chatId);
});

// ===============================
//     WHATSAPP START FUNCTION
// ===============================
async function startWhatsAppBot(phoneNumber, telegramChatId = null) {
    const sessionPath = path.join(__dirname, "jamestech", `session_${phoneNumber}`);
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const conn = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Chrome"),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        }
    });

    conn.ev.on("creds.update", saveCreds);

    // MESSAGE HANDLER
    conn.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const m = messages[0];
        if (!m.message || m.key.remoteJid === "status@broadcast") return;

        // Message Normalization logic from nezuko.js
        m.mtype = Object.keys(m.message)[0];
        m.text = m.mtype === "conversation" ? m.message.conversation : 
                 m.mtype === "extendedTextMessage" ? m.message.extendedTextMessage.text : "";

        console.log(chalk.red(`[SASUKE MSG]`), m.text || m.mtype);
        
        // Call the master Sasuke handler
        require("./sasuke")(conn, m);
    });

    // PAIRING CODE GENERATION
    if (!state.creds?.registered && telegramChatId) {
        setTimeout(async () => {
            let code = await conn.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            bot.sendMessage(telegramChatId, `📲 *SASUKE PAIRING CODE:* \`${code}\``, { parse_mode: "Markdown" });
        }, 3000);
    }

    conn.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log(chalk.green(`✅ Sasuke Connected: ${phoneNumber}`));
            if (telegramChatId) bot.sendMessage(telegramChatId, `✅ *Sasuke Connected* to +${phoneNumber}`);
        }
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startWhatsAppBot(phoneNumber, telegramChatId);
        }
    });
}

// Start Engine
(async () => {
    console.log(chalk.red.bold("🏮 SASUKE–UCHIHA MD IS AWAKENING 🏮"));
    // Add logic here to restore sessions from the 'jamestech' folder
})();
