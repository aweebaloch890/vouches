require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionFlagsBits,
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


// ================= REGISTER SLASH COMMANDS =================
const commands = [
    new SlashCommandBuilder().setName("clear")
        .setDescription("Clear messages")
        .addIntegerOption(option =>
            option.setName("amount")
                .setDescription("Number of messages")
                .setRequired(true)),

    new SlashCommandBuilder().setName("ban")
        .setDescription("Ban a user")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("User to ban")
                .setRequired(true)),

    new SlashCommandBuilder().setName("unban")
        .setDescription("Unban a user")
        .addStringOption(option =>
            option.setName("userid")
                .setDescription("User ID to unban")
                .setRequired(true)),

    new SlashCommandBuilder().setName("mute")
        .setDescription("Mute user for 5 minutes")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("User to mute")
                .setRequired(true)),

    new SlashCommandBuilder().setName("unmute")
        .setDescription("Remove timeout")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("User to unmute")
                .setRequired(true)),

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


// ================= PREFIX VOUCH =================
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "vouch") {

        if (args.length < 4)
            return message.reply("Usage: <<vouch @seller product price rating(1-5) reason");

        const seller = message.mentions.users.first();
        if (!seller) return message.reply("❌ Mention seller.");

        const product = args[1];
        const price = args[2];
        const rating = parseInt(args[3]);
        const reason = args.slice(4).join(" ") || "No reason.";

        if (isNaN(rating) || rating < 1 || rating > 5)
            return message.reply("❌ Rating 1-5 only.");

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

        return message.reply("✅ Vouch submitted!");
    }
});


// ================= SLASH COMMAND HANDLER =================
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // ADMIN CHECK
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: "❌ Admin only.", ephemeral: true });

    const { commandName } = interaction;

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
        const user = interaction.options.getMember("user");
        await user.timeout(5 * 60000);
        return interaction.reply(`🔇 Muted for 5 minutes.`);
    }

    if (commandName === "unmute") {
        const user = interaction.options.getMember("user");
        await user.timeout(null);
        return interaction.reply(`✅ Timeout removed.`);
    }

    if (commandName === "timeout") {
        const user = interaction.options.getMember("user");
        const minutes = interaction.options.getInteger("minutes");
        await user.timeout(minutes * 60000);
        return interaction.reply(`⏳ Timeout ${minutes} minutes.`);
    }
});


// Keep Alive
require("http").createServer((req, res) => {
    res.end("Bot Running");
}).listen(3000);

client.login(process.env.TOKEN);
