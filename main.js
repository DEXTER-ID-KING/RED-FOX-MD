
import dotenv from 'dotenv';
dotenv.config();

import {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');
import { Handler, Callupdate, GroupUpdate } from './config/index.js';
import express from 'express';
import pino from 'pino';
import fs from 'fs';
import NodeCache from 'node-cache';
import path from 'path';
import chalk from 'chalk';
import moment from 'moment-timezone';
import axios from 'axios';
import config from './config.cjs';
import pkg from './lib/autoreact.cjs';
const { emojis, doReact } = pkg;

const sessionName = "session";
const app = express();
const orange = chalk.bold.hex("#FFA500");
const lime = chalk.bold.hex("#32CD32");
let useQR = false;
let initialConnection = true;
const PORT = process.env.PORT || 3000;

const MAIN_LOGGER = pino({
    timestamp: () => `,"time":"${new Date().toJSON()}"`
});
const logger = MAIN_LOGGER.child({});
logger.level = "trace";

const msgRetryCounterCache = new NodeCache();

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);


const sessionDir = path.join(__dirname, 'session');
const credsPath = path.join(sessionDir, 'creds.json');

if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

async function downloadSessionData() {
    if (!config.SESSION_ID) {
        console.error('❌ Please set SESSION_ID in environment variables!');
        return false;
    }

    const prefix = "HESHAN-MD~";
    
    if (config.SESSION_ID.startsWith(prefix)) {
        try {
            const base64Data = config.SESSION_ID.slice(prefix.length);
            const decodedData = Buffer.from(base64Data, 'base64').toString('utf-8');
            
            await fs.promises.writeFile(credsPath, decodedData);
            console.log("🔒 Session decoded and saved successfully!");
            return true;
        } catch (error) {
            console.error('❌ Base64 decode failed:', error.message);
            return false;
        }
    } else {
        console.error('❌ SESSION_ID must start with "DASSA" prefix!');
        return false;
    }
}

async function start() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`🦊using WA v${version.join('.')}, isLatest: ${isLatest}`);
        
        const Fox = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: useQR,
            browser: ["Red--MD", "safari", "3.3"],
            auth: state,
            getMessage: async (key) => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg.message || undefined;
                }
                return { conversation: "⏳Testing⏳" };
            }
        });

        Fox.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                    start();
                }
            } else if (connection === 'open') {
                if (initialConnection) {
                    console.log(chalk.green("🦊Successful️ ✅"));
                    Fox.sendMessage(Fox.user.id, { text: `🦊Red Fox MD Bot Deploy Successful️ ✅` });
                    initialConnection = false;
                } else {
                    console.log(chalk.blue("♻️ Connection reestablished after restart.🦊"));
                    const newsletterJid = "120363286758767913@newsletter";
      try {
        await sock.newsletterFollow(newsletterJid);
        await sock.newsletterReactMessage(newsletterJid, "👍");
        console.log('✅ Auto-followed newsletter & reacted 👍');
      } catch (e) {
        console.log('❌ Newsletter auto-follow failed:', e.message);
      }
    }
  });

        Fox.ev.on('creds.update', saveCreds);

        Fox.ev.on("messages.upsert", async chatUpdate => await Handler(chatUpdate, Fox, logger));
        Fox.ev.on("call", async (json) => await Callupdate(json, Fox));
        Fox.ev.on("group-participants.update", async (messag) => await GroupUpdate(Fox, messag));

        if (config.MODE === "public") {
            Fox.public = true;
        } else if (config.MODE === "private") {
            Fox.public = false;
        }

        Fox.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek.key.fromMe && config.AUTO_REACT) {
                    console.log(mek);
                    if (mek.message) {
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        await doReact(randomEmoji, mek, Fox);
                    }
                }
            } catch (err) {
                console.error('Error during auto reaction:', err);
            }
        });
    } catch (error) {
        console.error('Critical Error:', error);
        process.exit(1);
    }
}

async function init() {
    if (fs.existsSync(credsPath)) {
        console.log("🛠️ Session ID found📛");
        await start();
    } else {
        const sessionDownloaded = await downloadSessionData();
        if (sessionDownloaded) {
            console.log("🔑 Session downloaded, starting bot.�🔓");
            await start();
        } else {
            console.log("🔐No session found or downloaded⚙️");
            useQR = true;
            await start();
        }
    }
}

init();

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(PORT, () => {
    console.log(`✨️✨Server is running on port ${PORT}`);
});
