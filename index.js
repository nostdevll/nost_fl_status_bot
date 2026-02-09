import fetch from "node-fetch";
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
const TWITCH_LINK = "https://twitch.tv/nost___";

// Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

let accessToken = null;
let lastState = "offline";

// -----------------------------
//  TWITCH TOKEN
// -----------------------------
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
