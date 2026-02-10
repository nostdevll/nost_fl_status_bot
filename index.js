import fetch from "node-fetch";
import fs from "fs";
import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes 
} from "discord.js";

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

  const nextLevelXP = Math.floor(100 * Math.pow(xpData[userId].level, 1.5));

  if (xpData[userId].xp >= nextLevelXP) {
    xpData[userId].level++;
    saveXP();
    return true;
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

  if (isLive && lastState !== "live") {
    console.log("🔴 Passage en LIVE");

    client.user.setPresence({
      activities: [{ name: LIVE_STATUS }],
      status: "online"
    });

    await announceLiveStart();
    lastState = "live";
  }

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
//  COMMANDES SLASH
// -----------------------------
const commands = [
  {
    name: "rank",
    description: "Affiche ton niveau et ton XP"
  }
];

client.on("ready", async () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("Commande /rank enregistrée");
  } catch (err) {
    console.error(err);
  }

  checkLive();
  setInterval(checkLive, 30000);
});

// -----------------------------
//  INTERACTIONCREATE : /rank
// -----------------------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "rank") {
    const userId = interaction.user.id;

    if (!xpData[userId]) {
      xpData[userId] = { xp: 0, level: 1 };
      saveXP();
    }

    const level = xpData[userId].level;
    const xp = xpData[userId].xp;
    const nextXP = Math.floor(100 * Math.pow(level, 1.5));

    const percent = Math.floor((xp / nextXP) * 100);

    const embed = {
      title: `📊 Rang de ${interaction.user.username}`,
      color: 0x00aaff,
      fields: [
        { name: "Niveau", value: `${level}`, inline: true },
        { name: "XP", value: `${xp} / ${nextXP}`, inline: true },
        { name: "Progression", value: `${percent}%`, inline: false }
      ]
    };

    await interaction.reply({ embeds: [embed] });
  }
});

// -----------------------------
//  SYSTEME XP : MESSAGECREATE
// -----------------------------
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  const levelUp = addXP(userId, 10);

  if (levelUp) {
    message.channel.send(
      `🎉 GG ${message.author}, tu passes **niveau ${xpData[userId].level}** !`
    );
  }
});

// -----------------------------
//  LOGIN DISCORD
// -----------------------------
client.login(DISCORD_TOKEN);
