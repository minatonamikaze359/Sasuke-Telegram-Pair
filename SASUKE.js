/**
 * SASUKE MD - Pokémon & Clan System
 * File: SASUKE.js
 */
const axios = require("axios");
const fs = require("fs");

// Databases
const POKE_DB = "./sasuke_poke.json";
const CLAN_DB = "./sasuke_clans.json";

if (!fs.existsSync(POKE_DB)) fs.writeFileSync(POKE_DB, JSON.stringify({}));
if (!fs.existsSync(CLAN_DB)) fs.writeFileSync(CLAN_DB, JSON.stringify({}));

module.exports = async (conn, m) => {
    try {
        const prefix = ".";
        const ownerNumber = "8801719741293";
        const ownerName = "Minato Namikaze";
        
        const body = m.text || (m.message?.conversation) || "";
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);
        const from = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        
        const db = JSON.parse(fs.readFileSync(POKE_DB));
        const clans = JSON.parse(fs.readFileSync(CLAN_DB));

        // --- COMMANDS ---
        switch (command) {
            case "ping":
                await conn.sendMessage(from, { text: "🦅 Chidori! (Active)" }, { quoted: m });
                break;

            case "owner":
                await conn.sendMessage(from, { text: `👑 Owner: ${ownerName}\nNumber: wa.me/${ownerNumber}` }, { quoted: m });
                break;

            // POKEMON SYSTEM
            case "catch":
                const id = Math.floor(Math.random() * 898) + 1;
                const poke = (await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`)).data;
                
                if (!db[sender]) db[sender] = { cards: [] };
                db[sender].cards.push({ name: poke.name, level: 1 });
                fs.writeFileSync(POKE_DB, JSON.stringify(db));

                await conn.sendMessage(from, { 
                    image: { url: poke.sprites.other['official-artwork'].front_default },
                    caption: `🦅 *Sasuke Catch!* You found a ${poke.name.toUpperCase()}!`
                }, { quoted: m });
                break;

            // CLAN SYSTEM
            case "clancreate":
                const cName = args.join(" ");
                clans[sender] = { name: cName, leader: sender, members: [sender], coLeaders: [], elders: [] };
                fs.writeFileSync(CLAN_DB, JSON.stringify(clans));
                m.reply(`🏯 Clan *${cName}* established.`);
                break;

            case "promote":
                if (!clans[sender]) return m.reply("Only the leader can use this.");
                const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                const role = args[0]; // "co" or "elder"
                
                if (role === "co") clans[sender].coLeaders.push(target);
                else if (role === "elder") clans[sender].elders.push(target);
                
                fs.writeFileSync(CLAN_DB, JSON.stringify(clans));
                m.reply(`⭐ Promotion successful.`);
                break;

            case "tagall":
                const metadata = await conn.groupMetadata(from);
                let txt = `🦅 *Uchiha Summoning (Tag All)*\n\n`;
                for (let mem of metadata.participants) {
                    txt += `👁️ @${mem.id.split('@')[0]}\n`;
                }
                conn.sendMessage(from, { text: txt, mentions: metadata.participants.map(a => a.id) });
                break;
        }
    } catch (e) { console.log(e); }
};
