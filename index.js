import fetch from "node-fetch";
import { Client, GatewayIntentBits } from "discord.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_USER_ID = process.env.TWITCH_USER_ID;

const LIVE_STATUS = "🔴 En live sur twitch";
const OFFLINE_STATUS = "🟢 Commission Open";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

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

  if (isLive && lastState !== "live") {
    console.log("🔴 Passage en LIVE");
    client.user.setPresence({
      activities: [{ name: LIVE_STATUS }],
      status: "online"
    });
    lastState = "live";
  }

  if (!isLive && lastState !== "offline") {
    console.log("🟢 Passage en OFFLINE");
    client.user.setPresence({
      activities: [{ name: OFFLINE_STATUS }],
      status: "online"
    });
    lastState = "offline";
  }
}

client.on("ready", () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  checkLive();
  setInterval(checkLive, 30000);
});

client.login(DISCORD_TOKEN);
