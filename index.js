import fetch from "node-fetch";
import fs from "fs";
import { Client, GatewayIntentBits } from "discord.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_USER_ID = process.env.TWITCH_USER_ID;

// Statuts Discord
const LIVE_STATUS = "🔴 En live sur twitch";
const OFFLINE_STATUS = "🟢 Commission Open";

// Salon et rôle pour les annonces
const ANNOUNCE_CHANNEL_ID = "1455615555057881129";
const ROLE_LIVE_ID = "1455618290155262004";
const TWITCH_LINK = "https://twitch.tv/nost_fl";

// Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// -----------------------------
//  SYSTEME XP / NIVEAUX
// -----------------------------
let xpData = {};

if (fs.existsSync("levels.json")) {
  xpData = JSON.parse(fs.readFileSync("levels.json"));
}

function saveXP() {
  fs.writeFileSync("levels.json", JSON.stringify(xpData, null, 2));
}

// XP progressif : de plus en plus dur
function addXP(userId, amount) {
  if (!xpData[userId]) {
    xpData[userId] = { xp: 0, level: 1 };
  }

  xpData[userId].xp += amount;

  // XP requis pour le prochain niveau (progression exponentielle)
  const nextLevelXP = Math.floor(100 * Math.pow(xpData[userId].level, 1.5));

  if (xpData[userId].xp >= nextLevelXP) {
    xpData[userId].level++;
    saveXP();
    return true; // level up
  }

  saveXP();
  return false;
}

// -----------------------------
//  TWITCH TOKEN
// -----------------------------
let accessToken = null;
let lastState = "offline";

async function getTwitchToken() {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  const data = await res.json();
  accessToken = data.access_token;
}

// -----------------------------
//  ANNONCES DISCORD
// -----------------------------
async function announceLiveStart() {
  try {
    const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);
    await channel.send({
      content: `<@&${ROLE_LIVE_ID}> 🔴 **Nost est en LIVE !**\n${TWITCH_LINK}`
    });
  } catch (err) {
    console.error("Erreur annonce live start :", err);
  }
}

async function announceLiveEnd() {
  try {
    const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);
    await channel.send("🟢 Le live est terminé !");
  } catch (err) {
    console.error("Erreur annonce live end :", err);
  }
}

// -----------------------------
//  CHECK TWITCH LIVE
// -----------------------------
async function checkLive() {
  if (!accessToken) await getTwitchToken();

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_id=${TWITCH_USER_ID}`,
    {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const data = await res.json();
  const isLive = data.data && data.data.length > 0;

  // Passage en LIVE
  if (isLive && lastState !== "live") {
    console.log("🔴 Passage en LIVE");

    client.user.setPresence({
      activities: [{ name: LIVE_STATUS }],
      status: "online"
    });

    await announceLiveStart();
    lastState = "live";
  }

  // Passage en OFFLINE
  if (!isLive && lastState !== "offline") {
    console.log("🟢 Passage en OFFLINE");

    client.user.setPresence({
      activities: [{ name: OFFLINE_STATUS }],
      status: "online"
    });

    await announceLiveEnd();
    lastState = "offline";
  }
}

// -----------------------------
//  SYSTEME XP : MESSAGECREATE
// -----------------------------
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  const levelUp = addXP(userId, 10); // +10 XP par message

  if (levelUp) {
    message.channel.send(
      `🎉 GG ${message.author}, tu passes **niveau ${xpData[userId].level}** !`
    );
  }

  // Commande leaderboard en embed
  if (message.content === "!leaderboard") {
    const sorted = Object.entries(xpData)
      .sort((a, b) => b[1].xp - a[1].xp)
      .slice(0, 10);

    const embed = {
      title: "🏆 Leaderboard XP",
      description: "Voici les 10 membres les plus actifs du serveur",
      color: 0xffd700,
      fields: []
    };

    sorted.forEach(([id, data], index) => {
      embed.fields.push({
        name: `#${index + 1} — Niveau ${data.level}`,
        value: `<@${id}> — ${data.xp} XP`,
        inline: false
      });
    });

    message.channel.send({ embeds: [embed] });
  }
});

// -----------------------------
//  BOT READY
// -----------------------------
client.on("ready", () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  checkLive();
  setInterval(checkLive, 30000);
});

// -----------------------------
//  LOGIN DISCORD
// -----------------------------
client.login(DISCORD_TOKEN);
