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

// ================= READY =================
client.once("clientReady", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Register Slash Command
    await client.application.commands.set([
        {
            name: "vouch",
            description: "Submit a vouch",
            options: [
                { name: "product", description: "Product name", type: 3, required: true },
                { name: "price", description: "Product price", type: 3, required: true },
                { name: "seller", description: "Select seller", type: 6, required: true },
                { name: "rating", description: "Rating 1-5", type: 4, required: true, min_value: 1, max_value: 5 },
                { name: "reason", description: "Reason", type: 3, required: false }
            ]
        }
    ]);
});

// ================= LOG FUNCTION =================
function sendLog(guild, embed) {
    const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (channel) channel.send({ embeds: [embed] });
}

// ================= SLASH COMMAND =================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "vouch") {

        const product = interaction.options.getString("product");
        const price = interaction.options.getString("price");
        const seller = interaction.options.getUser("seller");
        const rating = interaction.options.getInteger("rating");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        const stars = "💗".repeat(rating) + ` (${rating}/5)`;
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
                { name: "🔎 Vouched By", value: `${interaction.user}`, inline: true },
                { name: "🆔 Vouch ID", value: vouchID, inline: true }
            )
            .setFooter({ text: "Force Voucher" }); // Timestamp removed

        const channel = client.channels.cache.get(VOUCH_CHANNEL_ID);
        if (channel) channel.send({ embeds: [embed] });

        // Save Data
        const data = JSON.parse(fs.readFileSync("./vouches.json"));
        if (!data[seller.id]) data[seller.id] = { count: 0, totalStars: 0 };

        data[seller.id].count += 1;
        data[seller.id].totalStars += rating;

        fs.writeFileSync("./vouches.json", JSON.stringify(data, null, 2));

        await interaction.reply({ content: "✅ Vouch submitted!", ephemeral: true });
    }
});

// ================= MESSAGE EVENTS =================
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
    if (!client.spam[message.author.id]) {
        client.spam[message.author.id] = { count: 1 };
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

// ===== DELETE LOG =====
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
