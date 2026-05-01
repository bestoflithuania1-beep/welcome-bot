// BestOfLithuania Welcome Bot
// -----------------------------------------------
// Reads its config from your Lovable dashboard every 60s,
// then welcomes new members in your configured channel.
//
// Setup:
//   1) npm init -y
//   2) npm install discord.js
//   3) Create a .env file (or set env vars on your host) with:
//        DISCORD_TOKEN=your-bot-token
//        CONFIG_URL=https://YOUR-LOVABLE-APP.lovable.app/api/public/welcome-config
//   4) node bot.js
//
// Required Discord bot intents (enable in the Discord Developer Portal):
//   - SERVER MEMBERS INTENT  (Privileged)
//   - MESSAGE CONTENT INTENT is NOT required.

const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CONFIG_URL = process.env.CONFIG_URL;

if (!TOKEN) throw new Error("Missing DISCORD_TOKEN env var");
if (!CONFIG_URL) throw new Error("Missing CONFIG_URL env var");

let cachedConfig = null;
let lastFetched = 0;
const CACHE_MS = 60_000;

async function getConfig() {
  const now = Date.now();
  if (cachedConfig && now - lastFetched < CACHE_MS) return cachedConfig;
  try {
    const res = await fetch(CONFIG_URL);
    if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
    cachedConfig = await res.json();
    lastFetched = now;
  } catch (err) {
    console.error("[config] fetch error:", err.message);
    if (!cachedConfig) throw err;
  }
  return cachedConfig;
}

function hexToInt(hex) {
  if (!hex) return 0xffb000;
  return parseInt(hex.replace("#", ""), 16) || 0xffb000;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("guildMemberAdd", async (member) => {
  try {
    const cfg = await getConfig();
    if (!cfg || cfg.is_active === false) return;

    // Find the channel by name (strip leading # if user added one)
    const target = String(cfg.channel_name || "").replace(/^#/, "").trim();
    const channel = member.guild.channels.cache.find(
      (c) => c.name === target && c.isTextBased?.()
    );
    if (!channel) {
      console.warn(`[welcome] channel "${target}" not found in ${member.guild.name}`);
      return;
    }

    const message = String(cfg.welcome_message || "Welcome %thenameoftheperson%!")
      .replaceAll("%thenameoftheperson%", `<@${member.id}>`);

    const embed = new EmbedBuilder()
      .setColor(hexToInt(cfg.embed_color))
      .setTitle(`Welcome to ${cfg.server_name || member.guild.name}!`)
      .setDescription(message)
      .setTimestamp();

    if (cfg.logo_url) embed.setThumbnail(cfg.logo_url);
    if (member.user.displayAvatarURL) {
      embed.setFooter({
        text: `Member #${member.guild.memberCount}`,
        iconURL: member.user.displayAvatarURL(),
      });
    }

    await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
  } catch (err) {
    console.error("[welcome] error:", err);
  }
});

client.login(TOKEN);