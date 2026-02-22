require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const fs = require("fs");

// ================= CONFIG =================
const config = {
   
    logChannel: "1475245949285564496",
    vouchChannel: "1403799364706767019"
};

// ==========================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

client.commands = new Collection();

// ================= DATABASE FILES =================
if (!fs.existsSync("./warns.json")) fs.writeFileSync("./warns.json", "{}");
if (!fs.existsSync("./vouches.json")) fs.writeFileSync("./vouches.json", "[]");

// ================= READY =================
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    const commands = [
        // Kick
        new SlashCommandBuilder()
            .setName("kick")
            .setDescription("Kick a member")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

        // Ban
        new SlashCommandBuilder()
            .setName("ban")
            .setDescription("Ban a member")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

        // Timeout
        new SlashCommandBuilder()
            .setName("timeout")
            .setDescription("Mute a member")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
            .addIntegerOption(o => o.setName("minutes").setDescription("Minutes").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

        // Warn
        new SlashCommandBuilder()
            .setName("warn")
            .setDescription("Warn a member")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
            .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

        // Role
        new SlashCommandBuilder()
            .setName("role")
            .setDescription("Add role to user")
            .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
            .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

        // Vouch
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

// ================= SLASH COMMAND HANDLER =================
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // ===== KICK =====
    if (commandName === "kick") {
        const member = interaction.options.getMember("user");
        await member.kick();
        interaction.reply(`✅ ${member.user.tag} kicked.`);
    }

    // ===== BAN =====
    if (commandName === "ban") {
        const member = interaction.options.getMember("user");
        await member.ban();
        interaction.reply(`🔨 ${member.user.tag} banned.`);
    }

    // ===== TIMEOUT =====
    if (commandName === "timeout") {
        const member = interaction.options.getMember("user");
        const minutes = interaction.options.getInteger("minutes");
        await member.timeout(minutes * 60 * 1000);
        interaction.reply(`🔇 ${member.user.tag} muted for ${minutes} minutes.`);
    }

    // ===== WARN SYSTEM =====
    if (commandName === "warn") {
        const member = interaction.options.getMember("user");
        const reason = interaction.options.getString("reason");

        const warns = JSON.parse(fs.readFileSync("./warns.json"));
        if (!warns[member.id]) warns[member.id] = [];
        warns[member.id].push(reason);

        fs.writeFileSync("./warns.json", JSON.stringify(warns, null, 2));

        interaction.reply(`⚠️ ${member.user.tag} warned. Total warns: ${warns[member.id].length}`);
    }

    // ===== ROLE MANAGEMENT =====
    if (commandName === "role") {
        const member = interaction.options.getMember("user");
        const role = interaction.options.getRole("role");

        await member.roles.add(role);
        interaction.reply(`✅ Role added to ${member.user.tag}`);
    }

    // ===== VOUCH SYSTEM =====
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
                { name: "💰 Price", value: "N/A", inline: true },
                { name: "👤 Seller", value: `${seller}`, inline: false },
                { name: "⭐ Rating", value: `${stars} (${rating}/5)`, inline: false },
                { name: "📝 Reason", value: reason, inline: false },
                { name: "🆔 Vouch ID", value: vouchID, inline: true },
                { name: "⏰ Timestamp", value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
            )
            .setFooter({ text: `Vouched by ${interaction.user.tag}` });

        const channel = client.channels.cache.get(config.vouchChannel);
        if (channel) channel.send({ embeds: [embed] });

        interaction.reply({ content: "✅ Vouch submitted!", ephemeral: true });
    }
});

// ================= AUTO MODERATION =================
client.on("messageCreate", async message => {
    if (message.author.bot) return;

    // Bad Words Filter
    const badWords = ["fuck", "bitch", "link"];
    if (badWords.some(word => message.content.toLowerCase().includes(word))) {
        await message.delete();
        message.channel.send(`⚠️ ${message.author}, bad word not allowed.`);
    }

    // Anti Spam
    if (!client.spam) client.spam = {};
    const now = Date.now();

    if (!client.spam[message.author.id]) {
        client.spam[message.author.id] = { count: 1, time: now };
    } else {
        client.spam[message.author.id].count++;
        if (client.spam[message.author.id].count >= 5) {
            message.member.timeout(5 * 60 * 1000);
            message.channel.send(`🔇 ${message.author} muted for spam.`);
            client.spam[message.author.id] = null;
        }
    }
});

// ================= LOGIN =================
client.login(config.token);
