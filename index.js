// ===============================
//        BASIC SETUP
// ===============================
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const chalk = require("chalk");
const TelegramBot = require("node-telegram-bot-api");

const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

// TELEGRAM TOKEN INTEGRATED
const TELEGRAM_TOKEN = "8451538739:AAHHVTnZCgyoRyPzH966bPHojPe3x5auR1o";
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ===============================
// SASUKE HOT-UPDATE HANDLER
// ===============================
const updateSASUKE = () => {
    console.log(chalk.hex("#6a0dad").bold("🔄 SASUKE logic updated — Sharingan refresh initiated 👁️"));
    try {
        const SASUKEModule = require.resolve("./SASUKE");
        delete require.cache[SASUKEModule];
        require("./SASUKE");
        console.log(chalk.hex("#a8dadc").bold("✅ SASUKE.js reloaded successfully"));
    } catch (err) {
        console.error(chalk.red("❌ Failed to reload SASUKE logic:"), err);
    }
};

const SASUKEPath = path.join(__dirname, "SASUKE.js");
fs.watchFile(SASUKEPath, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
        console.log(chalk.hex("#ff0000").bold("🌀 Mutation detected in SASUKE.js"));
        updateSASUKE();
    }
});

// ===============================
//      WHATSAPP LOGIC
// ===============================
async function startSasukeBot(phoneNumber, telegramChatId = null) {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/session_${phoneNumber}`);
    const conn = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        printQRInTerminal: false,
        browser: Browsers.macOS("Desktop")
    });

    conn.ev.on("creds.update", saveCreds);

    // MESSAGE HANDLER LINKED TO SASUKE.JS
    conn.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const m = messages[0];
        if (!m.message) return;
        
        // Pass to SASUKE.js logic
        require("./SASUKE")(conn, m);
    });

    // PAIRING CODE LOGIC
    if (!conn.authState.creds.registered && telegramChatId) {
        setTimeout(async () => {
            let code = await conn.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            bot.sendMessage(telegramChatId, `⚡ *SASUKE MD PAIRING*\n\nCode: \`${code}\``, { parse_mode: "Markdown" });
        }, 3000);
    }
}

// ===============================
//     TELEGRAM COMMANDS
// ===============================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🦅 *SASUKE MD* Online\nUse /pair <number> to link WhatsApp.");
});

bot.onText(/\/pair (.+)/, (msg, match) => {
    const phoneNumber = match[1].replace(/\D/g, "");
    bot.sendMessage(msg.chat.id, "⏳ Reaching out to the Uchiha archives...");
    startSasukeBot(phoneNumber, msg.chat.id);
});

console.log(chalk.bold.red("\n🦅 SASUKE MD SYSTEM INITIALIZED\n"));
