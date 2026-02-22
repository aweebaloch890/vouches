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

// ===== FILES =====
if (!fs.existsSync("./vouches.json"))
    fs.writeFileSync("./vouches.json", "{}");

// ================= READY =================
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    await client.application.commands.set([

        // ===== VOUCH =====
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
        },

        // ===== BAN =====
        {
            name: "ban",
            description: "Ban a member",
            options: [
                { name: "user", description: "User to ban", type: 6, required: true },
                { name: "reason", description: "Reason", type: 3, required: false }
            ]
        },

        // ===== UNBAN =====
        {
            name: "unban",
            description: "Unban a user",
            options: [
                { name: "userid", description: "User ID", type: 3, required: true }
            ]
        },

        // ===== TIMEOUT =====
        {
            name: "timeout",
            description: "Timeout a member (minutes)",
            options: [
                { name: "user", description: "User", type: 6, required: true },
                { name: "minutes", description: "Minutes", type: 4, required: true }
            ]
        },

        {
            name: "untimeout",
            description: "Remove timeout",
            options: [
                { name: "user", description: "User", type: 6, required: true }
            ]
        },

        // ===== MUTE =====
        {
            name: "mute",
            description: "Mute member (5 mins default)",
            options: [
                { name: "user", description: "User", type: 6, required: true }
            ]
        },

        // ===== CLEAR =====
        {
            name: "clear",
            description: "Clear messages",
            options: [
                { name: "amount", description: "Number (1-100)", type: 4, required: true }
            ]
        }

    ]);
});

// ================= LOG FUNCTION =================
function sendLog(guild, embed) {
    const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (channel) channel.send({ embeds: [embed] });
}

// ================= SLASH HANDLER =================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await interaction.deferReply({ ephemeral: true });

        // ===== VOUCH =====
        if (interaction.commandName === "vouch") {
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

            await interaction.editReply({ content: "✅ Vouch submitted!" });
        }

        // ===== BAN =====
        if (interaction.commandName === "ban") {
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
                return interaction.editReply("❌ No permission.");

            const user = interaction.options.getUser("user");
            const reason = interaction.options.getString("reason") || "No reason";

            await interaction.guild.members.ban(user.id, { reason });

            await interaction.editReply(`🔨 ${user.tag} banned.`);
        }

        // ===== UNBAN =====
        if (interaction.commandName === "unban") {
            const id = interaction.options.getString("userid");
            await interaction.guild.members.unban(id);
            await interaction.editReply(`✅ User unbanned.`);
        }

        // ===== TIMEOUT =====
        if (interaction.commandName === "timeout") {
            const user = interaction.options.getMember("user");
            const minutes = interaction.options.getInteger("minutes");

            await user.timeout(minutes * 60000);
            await interaction.editReply(`⏳ ${user.user.tag} timed out for ${minutes} minutes.`);
        }

        if (interaction.commandName === "untimeout") {
            const user = interaction.options.getMember("user");
            await user.timeout(null);
            await interaction.editReply(`✅ Timeout removed.`);
        }

        // ===== MUTE (5 mins) =====
        if (interaction.commandName === "mute") {
            const user = interaction.options.getMember("user");
            await user.timeout(5 * 60000);
            await interaction.editReply(`🔇 ${user.user.tag} muted for 5 minutes.`);
        }

        // ===== CLEAR =====
        if (interaction.commandName === "clear") {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                return interaction.editReply("❌ No permission.");

            const amount = interaction.options.getInteger("amount");
            if (amount < 1 || amount > 100)
                return interaction.editReply("❌ Choose between 1-100.");

            await interaction.channel.bulkDelete(amount, true);
            await interaction.editReply(`🧹 Cleared ${amount} messages.`);
        }

    } catch (err) {
        console.error(err);
        if (!interaction.replied)
            interaction.reply({ content: "❌ Error.", ephemeral: true });
    }
});

// ===== KEEP ALIVE =====
require("http").createServer((req, res) => {
    res.end("Bot Running");
}).listen(3000);

client.login(process.env.TOKEN);
