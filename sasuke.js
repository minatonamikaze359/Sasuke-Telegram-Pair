const { 
    downloadContentFromMessage, 
    generateWAMessageFromContent, 
    proto 
} = require("@whiskeysockets/baileys");
const { Anime, Character, Manga } = require('@shineiichijo/marika');
const supabase = require('./supabase'); 
const axios = require('axios');
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { tmpdir } = require("os");
const chalk = require("chalk");
const moment = require('moment-timezone');
const speed = require('performance-now');

// Global Settings
const owners = ['8801719741293@s.whatsapp.net']; // Replace with your number
const voiceId = 'vGQNBgLaiM3EdZtxIiuY'; // ElevenLabs Sasuke/Voice ID

module.exports = async (sock, m, store) => {
    try {
        if (!m.message) return;
        const from = m.key.remoteJid;
        const type = Object.keys(m.message)[0];
        const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (m.message[type]?.caption) ? m.message[type].caption : '';
        const prefix = '!';
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const text = args.join(" ");
        
        const sender = m.key.participant || m.key.remoteJid;
        const pushname = m.pushName || "Shinobi";
        const isGroup = from.endsWith('@g.us');

        // --- 1. PERMISSIONS & CHECKS ---
        const isOwner = owners.includes(sender);
        const groupMetadata = isGroup ? await sock.groupMetadata(from) : null;
        const participants = isGroup ? groupMetadata.participants : [];
        const groupAdmins = isGroup ? participants.filter(v => v.admin !== null).map(v => v.id) : [];
        const isBotAdmins = isGroup ? groupAdmins.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net') : false;
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false;

        // Public/Private Logic
        if (!sock.public && !isOwner) return; 

        // --- 2. LOGGING SYSTEM ---
        if (isCmd) {
            console.log(chalk.black.bgRed(`[ COMMAND ]`) + chalk.black.bgWhite(` ${moment().format('HH:mm:ss')} `) + chalk.red.bold(` ${command} `) + chalk.white(`from`) + chalk.yellow(` ${pushname} `) + (isGroup ? chalk.green(`in ${groupMetadata.subject}`) : chalk.blue(`in Private`)));
        }

        // --- 3. DATABASE FETCH (RPG Stats) ---
        let { data: user } = await supabase.from('users').select('*').eq('jid', sender).single();

        const reply = (txt) => {
            return sock.sendMessage(from, { text: `🌑 *ꜱᴀꜱᴜᴋᴇ-ᴜᴄʜɪʜᴀ* 🌑\n\n${txt}` }, { quoted: m });
        };

        if (isCmd) {
            switch (command) {
                // ===============================
                //       UTILITY & STATUS
                // ===============================
                case 'ping':
                case 'alive':
                    const timestamp = speed();
                    const lat = speed() - timestamp;
                    reply(`*Pong!* ⚡\n\n*Speed:* ${lat.toFixed(4)} ms\n*Uptime:* ${process.uptime().toFixed(0)}s\n*RAM:* ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB / 1024MB\n*Node:* ${process.version}`);
                    break;

                case 'owner':
                    reply("My master is *MINATO ☾*");
                    break;

                case 'runtime':
                    const dur = moment.duration(process.uptime(), 'seconds');
                    reply(`*Sasuke Uchiha MD Runtime:*\n${dur.days()}d ${dur.hours()}h ${dur.minutes()}m ${dur.seconds()}s`);
                    break;

                // ===============================
                //       GROUP MANAGEMENT
                // ===============================
                case 'kick':
                case 'remove':
                    if (!isGroup) return reply("Group only command.");
                    if (!isAdmins && !isOwner) return reply("Admins only.");
                    if (!isBotAdmins) return reply("I need to be Admin first.");
                    let users = m.message[type].contextInfo?.mentionedJid[0] || m.message[type].contextInfo?.participant || text.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                    await sock.groupParticipantsUpdate(from, [users], "remove");
                    reply("Target eliminated.");
                    break;

                case 'mute':
                    if (!isAdmins) return reply("Admin only.");
                    await sock.groupSettingUpdate(from, 'announcement');
                    reply("Group is now in *Zetsu Mode* (Muted).");
                    break;

                case 'unmute':
                    if (!isAdmins) return reply("Admin only.");
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    reply("Group is active again.");
                    break;

                case 'promote':
                case 'demote':
                    if (!isAdmins) return reply("Admin only.");
                    let target = m.message[type].contextInfo?.mentionedJid[0];
                    await sock.groupParticipantsUpdate(from, [target], command);
                    reply(`Successfully ${command}d.`);
                    break;

                // ===============================
                //       RPG SYSTEM (Supabase)
                // ===============================
                case 'register':
                    if (user) return reply("You are already registered.");
                    await supabase.from('users').insert([{ jid: sender, name: pushname, gold: 500, level: 1 }]);
                    reply(`✅ *Welcome, ${pushname}.* You have been added to the Uchiha Archives. [500 Gold Received]`);
                    break;

                case 'sj':
                    if (!user) return reply("Use !register first.");
                    reply("Choose your Starter: !sj --charmander | !sj --squirtle | !sj --bulbasaur");
                    break;

                case 'pss':
                    // Logic from pss.js
                    const pssData = await sock.poke?.get(`${sender}_PSS`) || [];
                    let pssTxt = `📋 *${pushname}'s Storage*:\n`;
                    pssData.map((p, i) => pssTxt += `${i+1}. ${p.name} (Lv. ${p.level})\n`);
                    reply(pssData.length ? pssTxt : "Storage is empty.");
                    break;

                // ===============================
                //       MEDIA CONVERSION
                // ===============================
                case 'toimage':
                case 'toimg':
                    const quoted = m.message[type]?.contextInfo?.quotedMessage;
                    if (!quoted?.stickerMessage) return reply("Reply to a sticker.");
                    reply("👁️‍🗨️ *Sharingan!* Extracting image...");
                    const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    const inP = path.join(tmpdir(), `s_${Date.now()}.webp`);
                    const outP = path.join(tmpdir(), `i_${Date.now()}.png`);
                    fs.writeFileSync(inP, buffer);
                    await sharp(inP).png().toFile(outP);
                    await sock.sendMessage(from, { image: fs.readFileSync(outP), caption: "Extracted successfully." }, { quoted: m });
                    fs.unlinkSync(inP); fs.unlinkSync(outP);
                    break;

                case 'ytmp4':
                    if (!text) return reply("Provide a YouTube link.");
                    reply("🔍 Searching the archives for your video...");
                    // Add your ytmp4 search & download logic here
                    break;

                // ===============================
                //       ANIME / WEEB
                // ===============================
                case 'anime':
                    const { data: ani } = await new Anime().searchAnime(text);
                    if (!ani[0]) return reply("Not found.");
                    await sock.sendMessage(from, { image: { url: ani[0].images.jpg.large_image_url }, caption: `*Title:* ${ani[0].title}\n*Episodes:* ${ani[0].episodes}` }, { quoted: m });
                    break;
            }
        }
    } catch (err) {
        console.error(err);
    }
};
