require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const fs = require("fs");

if (!process.env.TOKEN) {
    console.log("❌ TOKEN missing");
    process.exit(1);
}

const PREFIX = "<<";
const VOUCH_CHANNEL_ID = "1403799364706767019";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

if (!fs.existsSync("./vouches.json"))
    fs.writeFileSync("./vouches.json", "{}");

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ================= VOUCH =================
    if (command === "vouch") {

        if (args.length < 4)
            return message.reply("Usage: <<vouch @seller product price rating(1-5) reason");

        const seller = message.mentions.users.first();
        if (!seller) return message.reply("❌ Mention a seller.");

        const product = args[1];
        const price = args[2];
        const rating = parseInt(args[3]);
        const reason = args.slice(4).join(" ") || "No reason provided.";

        if (isNaN(rating) || rating < 1 || rating > 5)
            return message.reply("❌ Rating must be 1-5.");

        const stars = "⭐".repeat(rating) + ` (${rating}/5)`;
        const vouchID = Math.random().toString(36).substring(2, 8).toUpperCase();

        const embed = new EmbedBuilder()
            .setColor("#2B2D31")
            .setTitle("💗 • New Vouch Recorded!")
            .addFields(
                { name: "🛒 Product", value: product, inline: true },
                { name: "💲 Price", value: price, inline: true },
                { name: "👤 Seller", value: `${seller}`, inline: false },
                { name: "⭐ Rating", value: stars, inline: false },
                { name: "📝 Reason", value: reason, inline: false },
                { name: "🔎 Vouched By", value: `${message.author}`, inline: true },
                { name: "🆔 Vouch ID", value: vouchID, inline: true }
            )
            .setFooter({ text: "Force Voucher" });

        const channel = client.channels.cache.get(VOUCH_CHANNEL_ID);
        if (channel) channel.send({ embeds: [embed] });

        message.reply("✅ Vouch submitted!");
    }

    // ================= BAN =================
    if (command === "ban") {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
            return message.reply("❌ No permission.");

        const member = message.mentions.members.first();
        if (!member) return message.reply("❌ Mention user.");

        await member.ban();
        message.reply(`🔨 ${member.user.tag} banned.`);
    }

    // ================= MUTE =================
    if (command === "mute") {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply("❌ No permission.");

        const member = message.mentions.members.first();
        if (!member) return message.reply("❌ Mention user.");

        await member.timeout(5 * 60000);
        message.reply(`🔇 ${member.user.tag} muted for 5 minutes.`);
    }
});

// Keep Alive
require("http").createServer((req, res) => {
    res.end("Bot Running");
}).listen(3000);

client.login(process.env.TOKEN);
