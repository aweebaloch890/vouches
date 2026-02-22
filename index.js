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

const PREFIX = "!";
const VOUCH_CHANNEL_ID = "1403799364706767019";
const LOG_CHANNEL_ID = "1475245949285564496";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ===== DATABASE FILES =====
if (!fs.existsSync("./warns.json")) fs.writeFileSync("./warns.json", "{}");
if (!fs.existsSync("./vouches.json")) fs.writeFileSync("./vouches.json", "{}");

// ===== READY =====
client.once("clientReady", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== LOG FUNCTION =====
function sendLog(guild, embed) {
    const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (channel) channel.send({ embeds: [embed] });
}

// ===== MESSAGE EVENTS =====
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // ===== ANTI LINK =====
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        if (/(https?:\/\/)/gi.test(message.content)) {
            await message.delete().catch(() => {});
            return message.channel.send(`🔐 ${message.author}, links not allowed.`);
        }
    }

    // ===== ANTI SPAM =====
    if (!client.spam) client.spam = {};
    const now = Date.now();

    if (!client.spam[message.author.id]) {
        client.spam[message.author.id] = { count: 1, time: now };
    } else {
        client.spam[message.author.id].count++;
        if (client.spam[message.author.id].count >= 6) {
            await message.member.timeout(5 * 60000).catch(() => {});
            message.channel.send(`🔇 ${message.author} muted for spam.`);
            client.spam[message.author.id] = null;
        }
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(" ");
    const command = args.shift().toLowerCase();

    // ===== KICK =====
    if (command === "kick") {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers))
            return message.reply("❌ No permission.");

        const member = message.mentions.members.first();
        if (!member) return message.reply("Mention user.");

        await member.kick().catch(() => {});
        message.reply(`✅ ${member.user.tag} kicked.`);

        sendLog(message.guild,
            new EmbedBuilder()
                .setColor("Red")
                .setTitle("Member Kicked")
                .setDescription(`${member.user.tag} was kicked by ${message.author.tag}`)
        );
    }

    // ===== BAN =====
    if (command === "ban") {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
            return message.reply("❌ No permission.");

        const member = message.mentions.members.first();
        if (!member) return message.reply("Mention user.");

        await member.ban().catch(() => {});
        message.reply(`🔨 ${member.user.tag} banned.`);

        sendLog(message.guild,
            new EmbedBuilder()
                .setColor("DarkRed")
                .setTitle("Member Banned")
                .setDescription(`${member.user.tag} was banned by ${message.author.tag}`)
        );
    }

    // ===== TIMEOUT =====
    if (command === "timeout") {
        const member = message.mentions.members.first();
        const minutes = parseInt(args[1]);
        if (!member || isNaN(minutes))
            return message.reply("Use: !timeout @user 5");

        await member.timeout(minutes * 60000).catch(() => {});
        message.reply(`🔇 ${member.user.tag} muted for ${minutes} minutes.`);
    }

    // ===== WARN =====
    if (command === "warn") {
        const member = message.mentions.members.first();
        const reason = args.slice(1).join(" ");
        if (!member || !reason)
            return message.reply("Use: !warn @user reason");

        const warns = JSON.parse(fs.readFileSync("./warns.json"));
        if (!warns[member.id]) warns[member.id] = [];
        warns[member.id].push(reason);
        fs.writeFileSync("./warns.json", JSON.stringify(warns, null, 2));

        message.reply(`⚠ ${member.user.tag} warned. Total: ${warns[member.id].length}`);
    }

    // ===== VOUCH =====
    if (command === "vouch") {
        const mention = message.mentions.users.first();
        const parts = message.content.split("|");
        if (!mention || parts.length < 4)
            return message.reply("Use: !vouch @user | product | rating | reason");

        const product = parts[1].trim();
        const rating = parseInt(parts[2].trim());
        const reason = parts[3].trim();

        const stars = "⭐".repeat(rating);
        const vouchID = Math.random().toString(36).substring(2, 8).toUpperCase();

        const embed = new EmbedBuilder()
            .setColor("#8A2BE2")
            .setTitle("🛍️ New Vouch")
            .addFields(
                { name: "Seller", value: `${mention}`, inline: true },
                { name: "Product", value: product, inline: true },
                { name: "Rating", value: `${stars}` },
                { name: "Reason", value: reason },
                { name: "Vouch ID", value: vouchID }
            );

        const channel = client.channels.cache.get(VOUCH_CHANNEL_ID);
        if (channel) channel.send({ embeds: [embed] });

        const data = JSON.parse(fs.readFileSync("./vouches.json"));
        if (!data[mention.id]) data[mention.id] = { count: 0 };
        data[mention.id].count++;
        fs.writeFileSync("./vouches.json", JSON.stringify(data, null, 2));

        message.reply("✅ Vouch submitted!");
    }

    // ===== LEADERBOARD =====
    if (command === "leaderboard") {
        const data = JSON.parse(fs.readFileSync("./vouches.json"));

        const sorted = Object.entries(data)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10);

        let desc = "";
        sorted.forEach((user, i) => {
            desc += `**${i + 1}.** <@${user[0]}> - ${user[1].count} vouches\n`;
        });

        const embed = new EmbedBuilder()
            .setColor("Gold")
            .setTitle("🏆 Vouch Leaderboard")
            .setDescription(desc || "No data.");

        message.channel.send({ embeds: [embed] });
    }

    // ===== SELLER STATS =====
    if (command === "sellerstats") {
        const user = message.mentions.users.first();
        if (!user) return message.reply("Mention seller.");

        const data = JSON.parse(fs.readFileSync("./vouches.json"));
        const count = data[user.id]?.count || 0;

        message.reply(`📊 ${user.tag} has **${count}** total vouches.`);
    }
});

// ===== MESSAGE DELETE LOG =====
client.on("messageDelete", (message) => {
    if (!message.guild || message.author?.bot) return;
    sendLog(message.guild,
        new EmbedBuilder()
            .setColor("Orange")
            .setTitle("Message Deleted")
            .setDescription(`User: ${message.author?.tag}\nContent: ${message.content}`)
    );
});

// ===== JOIN/LEAVE LOG =====
client.on("guildMemberAdd", member => {
    sendLog(member.guild,
        new EmbedBuilder()
            .setColor("Green")
            .setTitle("Member Joined")
            .setDescription(`${member.user.tag} joined.`)
    );
});

client.on("guildMemberRemove", member => {
    sendLog(member.guild,
        new EmbedBuilder()
            .setColor("Grey")
            .setTitle("Member Left")
            .setDescription(`${member.user.tag} left.`)
    );
});

// ===== KEEP ALIVE =====
require("http").createServer((req, res) => {
    res.end("Bot Running");
}).listen(3000);

// ===== LOGIN =====
client.login(process.env.TOKEN);
