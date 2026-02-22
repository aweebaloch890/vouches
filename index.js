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

const GUILD_ID = "1337111106971504661"; // ⚠️ PUT YOUR SERVER ID HERE
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

if (!fs.existsSync("./vouches.json"))
    fs.writeFileSync("./vouches.json", "{}");

// ================= READY =================
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    const guild = await client.guilds.fetch(GUILD_ID);

    await guild.commands.set([
        {
            name: "vouch",
            description: "Submit a vouch",
            options: [
                { name: "product", type: 3, description: "Product", required: true },
                { name: "price", type: 3, description: "Price", required: true },
                { name: "seller", type: 6, description: "Seller", required: true },
                { name: "rating", type: 4, description: "1-5", required: true, min_value: 1, max_value: 5 },
                { name: "reason", type: 3, description: "Reason", required: false }
            ]
        },
        {
            name: "ban",
            description: "Ban member",
            options: [{ name: "user", type: 6, description: "User", required: true }]
        },
        {
            name: "unban",
            description: "Unban user",
            options: [{ name: "userid", type: 3, description: "User ID", required: true }]
        },
        {
            name: "timeout",
            description: "Timeout member",
            options: [
                { name: "user", type: 6, description: "User", required: true },
                { name: "minutes", type: 4, description: "Minutes", required: true }
            ]
        },
        {
            name: "untimeout",
            description: "Remove timeout",
            options: [{ name: "user", type: 6, description: "User", required: true }]
        },
        {
            name: "mute",
            description: "Mute 5 minutes",
            options: [{ name: "user", type: 6, description: "User", required: true }]
        },
        {
            name: "clear",
            description: "Clear messages",
            options: [{ name: "amount", type: 4, description: "1-100", required: true }]
        }
    ]);

    console.log("✅ Slash commands loaded");
});

// ================= SAFE REPLY FUNCTION =================
async function safeReply(interaction, content) {
    if (interaction.deferred || interaction.replied)
        return interaction.editReply({ content });
    else
        return interaction.reply({ content, ephemeral: true });
}

// ================= SLASH HANDLER =================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {

        // ===== VOUCH =====
        if (interaction.commandName === "vouch") {

            await interaction.reply({ content: "⏳ Processing...", ephemeral: true });

            const product = interaction.options.getString("product");
            const price = interaction.options.getString("price");
            const seller = interaction.options.getUser("seller");
            const rating = interaction.options.getInteger("rating");
            const reason = interaction.options.getString("reason") || "No reason provided.";

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
                    { name: "🔎 Vouched By", value: `${interaction.user}`, inline: true },
                    { name: "🆔 Vouch ID", value: vouchID, inline: true }
                )
                .setFooter({ text: "Force Voucher" });

            const channel = client.channels.cache.get(VOUCH_CHANNEL_ID);
            if (channel) await channel.send({ embeds: [embed] });

            return interaction.editReply("✅ Vouch submitted successfully!");
        }

        // ===== BAN =====
        if (interaction.commandName === "ban") {
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
                return safeReply(interaction, "❌ No permission.");

            const user = interaction.options.getUser("user");
            await interaction.guild.members.ban(user.id);
            return safeReply(interaction, `🔨 ${user.tag} banned.`);
        }

        // ===== UNBAN =====
        if (interaction.commandName === "unban") {
            const id = interaction.options.getString("userid");
            await interaction.guild.members.unban(id);
            return safeReply(interaction, "✅ User unbanned.");
        }

        // ===== TIMEOUT =====
        if (interaction.commandName === "timeout") {
            const member = interaction.options.getMember("user");
            const minutes = interaction.options.getInteger("minutes");
            await member.timeout(minutes * 60000);
            return safeReply(interaction, `⏳ Timed out for ${minutes} minutes.`);
        }

        if (interaction.commandName === "untimeout") {
            const member = interaction.options.getMember("user");
            await member.timeout(null);
            return safeReply(interaction, "✅ Timeout removed.");
        }

        // ===== MUTE =====
        if (interaction.commandName === "mute") {
            const member = interaction.options.getMember("user");
            await member.timeout(5 * 60000);
            return safeReply(interaction, "🔇 Muted for 5 minutes.");
        }

        // ===== CLEAR =====
        if (interaction.commandName === "clear") {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                return safeReply(interaction, "❌ No permission.");

            const amount = interaction.options.getInteger("amount");
            await interaction.channel.bulkDelete(amount, true);
            return safeReply(interaction, `🧹 Cleared ${amount} messages.`);
        }

    } catch (err) {
        console.error(err);
        if (!interaction.replied)
            interaction.reply({ content: "❌ Something went wrong.", ephemeral: true });
    }
});

// ===== KEEP ALIVE =====
require("http").createServer((req, res) => {
    res.end("Bot Running");
}).listen(3000);

client.login(process.env.TOKEN);
