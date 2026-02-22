require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const fs = require("fs");

// ================= ENV CHECK =================
if (!process.env.TOKEN) {
    console.log("❌ TOKEN not found in environment variables!");
    process.exit(1);
}

// ================= CONFIG =================
const config = {
    logChannel: "LOG_CHANNEL_ID",       // optional
    vouchChannel: "VOUCH_CHANNEL_ID"    // required for vouch
};

// ================= CLIENT =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ================= DATABASE =================
if (!fs.existsSync("./warns.json")) fs.writeFileSync("./warns.json", "{}");

// ================= READY =================
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName("kick")
            .setDescription("Kick a member")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

        new SlashCommandBuilder()
            .setName("ban")
            .setDescription("Ban a member")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

        new SlashCommandBuilder()
            .setName("timeout")
            .setDescription("Mute a member")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
            .addIntegerOption(o => o.setName("minutes").setDescription("Minutes").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

        new SlashCommandBuilder()
            .setName("warn")
            .setDescription("Warn a member")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
            .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

        new SlashCommandBuilder()
            .setName("role")
            .setDescription("Add role to user")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
            .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

        new SlashCommandBuilder()
            .setName("vouch")
            .setDescription("Give vouch")
            .addUserOption(o => o.setName("seller").setDescription("Seller").setRequired(true))
            .addStringOption(o => o.setName("product").setDescription("Product").setRequired(true))
            .addIntegerOption(o => o.setName("rating").setDescription("1-5").setRequired(true))
            .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    ].map(c => c.toJSON());

    await client.application.commands.set(commands);
});

// ================= COMMAND HANDLER =================
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {

        if (commandName === "kick") {
            const member = interaction.options.getMember("user");
            await member.kick();
            return interaction.reply(`✅ ${member.user.tag} kicked.`);
        }

        if (commandName === "ban") {
            const member = interaction.options.getMember("user");
            await member.ban();
            return interaction.reply(`🔨 ${member.user.tag} banned.`);
        }

        if (commandName === "timeout") {
            const member = interaction.options.getMember("user");
            const minutes = interaction.options.getInteger("minutes");
            await member.timeout(minutes * 60 * 1000);
            return interaction.reply(`🔇 ${member.user.tag} muted for ${minutes} minutes.`);
        }

        if (commandName === "warn") {
            const member = interaction.options.getMember("user");
            const reason = interaction.options.getString("reason");

            const warns = JSON.parse(fs.readFileSync("./warns.json"));
            if (!warns[member.id]) warns[member.id] = [];
            warns[member.id].push(reason);
            fs.writeFileSync("./warns.json", JSON.stringify(warns, null, 2));

            return interaction.reply(`⚠️ ${member.user.tag} warned. Total warns: ${warns[member.id].length}`);
        }

        if (commandName === "role") {
            const member = interaction.options.getMember("user");
            const role = interaction.options.getRole("role");
            await member.roles.add(role);
            return interaction.reply(`✅ Role added to ${member.user.tag}`);
        }

        if (commandName === "vouch") {
            const seller = interaction.options.getUser("seller");
            const product = interaction.options.getString("product");
            const rating = interaction.options.getInteger("rating");
            const reason = interaction.options.getString("reason");

            const stars = "⭐".repeat(rating);
            const vouchID = Math.random().toString(36).substring(2, 8).toUpperCase();

            const embed = new EmbedBuilder()
                .setColor("#8A2BE2")
                .setTitle("🛍️ New Vouch Recorded!")
                .addFields(
                    { name: "📦 Product", value: product, inline: true },
                    { name: "👤 Seller", value: `${seller}`, inline: true },
                    { name: "⭐ Rating", value: `${stars} (${rating}/5)` },
                    { name: "📝 Reason", value: reason },
                    { name: "🆔 Vouch ID", value: vouchID, inline: true },
                    { name: "⏰ Timestamp", value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
                )
                .setFooter({ text: `Vouched by ${interaction.user.tag}` });

            const channel = client.channels.cache.get(config.vouchChannel);
            if (channel) channel.send({ embeds: [embed] });

            return interaction.reply({ content: "✅ Vouch submitted!", ephemeral: true });
        }

    } catch (err) {
        console.log(err);
        interaction.reply({ content: "❌ Error occurred.", ephemeral: true });
    }
});

// ================= AUTO MOD =================
client.on("messageCreate", async message => {
    if (message.author.bot) return;

    const badWords = ["fuck", "bitch"];
    if (badWords.some(w => message.content.toLowerCase().includes(w))) {
        await message.delete();
        message.channel.send(`⚠️ ${message.author}, bad words not allowed.`);
    }
});

// ================= KEEP ALIVE FOR RAILWAY =================
require("http").createServer((req, res) => {
    res.end("Bot is running");
}).listen(3000);

// ================= LOGIN =================
client.login(process.env.TOKEN);
