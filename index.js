require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    SlashCommandBuilder,
    Routes,
    REST
} = require("discord.js");

const fs = require("fs");

if (!process.env.TOKEN || !process.env.CLIENT_ID) {
    console.log("❌ TOKEN or CLIENT_ID missing in .env");
    process.exit(1);
}

const VOUCH_CHANNEL_ID = "1403799364706767019";
const ADMIN_ROLE_ID = "1397441836330651798";

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


// ================= REGISTER SLASH COMMANDS =================
const commands = [

    // PUBLIC VOUCH (Everyone Can See)
    new SlashCommandBuilder().setName("vouch")
        .setDescription("Give a vouch to a seller")
        .addUserOption(option =>
            option.setName("seller")
                .setDescription("Seller user")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("product")
                .setDescription("Product name")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("price")
                .setDescription("Product price")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("rating")
                .setDescription("Rating 1-5")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason")
                .setRequired(false)),

    // ADMIN ONLY COMMANDS (Hidden)
    new SlashCommandBuilder().setName("clear")
        .setDescription("Clear messages")
        .addIntegerOption(option =>
            option.setName("amount")
                .setDescription("Number of messages")
                .setRequired(true))
        .setDefaultMemberPermissions(0),

    new SlashCommandBuilder().setName("ban")
        .setDescription("Ban a user")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("User to ban")
                .setRequired(true))
        .setDefaultMemberPermissions(0),

    new SlashCommandBuilder().setName("unban")
        .setDescription("Unban a user")
        .addStringOption(option =>
            option.setName("userid")
                .setDescription("User ID")
                .setRequired(true))
        .setDefaultMemberPermissions(0),

    new SlashCommandBuilder().setName("mute")
        .setDescription("Mute user (5 min)")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("User")
                .setRequired(true))
        .setDefaultMemberPermissions(0),

    new SlashCommandBuilder().setName("unmute")
        .setDescription("Remove timeout")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("User")
                .setRequired(true))
        .setDefaultMemberPermissions(0),

    new SlashCommandBuilder().setName("timeout")
        .setDescription("Timeout user")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("User")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("minutes")
                .setDescription("Minutes")
                .setRequired(true))
        .setDefaultMemberPermissions(0)

].map(cmd => cmd.toJSON());

client.once("clientReady", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

    await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
    );

    console.log("✅ Slash commands registered");
});


// ================= SLASH HANDLER =================
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // ================= PUBLIC VOUCH =================
    if (commandName === "vouch") {

        const seller = interaction.options.getUser("seller");
        const product = interaction.options.getString("product");
        const price = interaction.options.getString("price");
        const rating = interaction.options.getInteger("rating");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        if (rating < 1 || rating > 5)
            return interaction.reply({ content: "❌ Rating must be 1-5.", ephemeral: true });

        const stars = "⭐".repeat(rating);
        const vouchID = Math.random().toString(36).substring(2, 8).toUpperCase();

        const embed = new EmbedBuilder()
            .setColor("#2B2D31")
            .setTitle("💗 • New Vouch Recorded!")
            .addFields(
                { name: "🛒 Product", value: product, inline: true },
                { name: "💲 Price", value: price, inline: true },
                { name: "👤 Seller", value: `${seller}` },
                { name: "⭐ Rating", value: stars },
                { name: "📝 Reason", value: reason },
                { name: "🆔 Vouch ID", value: vouchID }
            );

        const channel = client.channels.cache.get(VOUCH_CHANNEL_ID);
        if (channel) channel.send({ embeds: [embed] });

        return interaction.reply({ content: "✅ Vouch submitted!", ephemeral: true });
    }

    // ================= ROLE CHECK FOR ADMIN COMMANDS =================
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return interaction.reply({ content: "❌ You don't have permission.", ephemeral: true });
    }

    if (commandName === "clear") {
        const amount = interaction.options.getInteger("amount");
        await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: `✅ Deleted ${amount} messages`, ephemeral: true });
    }

    if (commandName === "ban") {
        const user = interaction.options.getUser("user");
        await interaction.guild.members.ban(user.id);
        return interaction.reply(`🔨 ${user.tag} banned.`);
    }

    if (commandName === "unban") {
        const id = interaction.options.getString("userid");
        await interaction.guild.members.unban(id);
        return interaction.reply(`✅ User unbanned.`);
    }

    if (commandName === "mute") {
        const member = interaction.options.getMember("user");
        await member.timeout(5 * 60000);
        return interaction.reply(`🔇 Muted for 5 minutes.`);
    }

    if (commandName === "unmute") {
        const member = interaction.options.getMember("user");
        await member.timeout(null);
        return interaction.reply(`✅ Timeout removed.`);
    }

    if (commandName === "timeout") {
        const member = interaction.options.getMember("user");
        const minutes = interaction.options.getInteger("minutes");
        await member.timeout(minutes * 60000);
        return interaction.reply(`⏳ Timeout ${minutes} minutes.`);
    }
});


// Keep Alive
require("http").createServer((req, res) => {
    res.end("Bot Running");
}).listen(3000);

client.login(process.env.TOKEN);
