require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    SlashCommandBuilder,
    Routes,
    REST,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
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
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

if (!fs.existsSync("./vouches.json"))
    fs.writeFileSync("./vouches.json", "{}");


// ================= REGISTER SLASH COMMANDS =================
const commands = [

    new SlashCommandBuilder().setName("vouch")
        .setDescription("Submit a vouch for a seller")
        .addUserOption(option =>
            option.setName("seller")
                .setDescription("Select the seller")
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
                .setDescription("Rating (1-5)")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the review")
                .setRequired(false)),

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
        .setDescription("Mute user (5 minutes)")
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

    // ================= VOUCH =================
    if (commandName === "vouch") {

        const seller = interaction.options.getUser("seller");
        const product = interaction.options.getString("product");
        const price = interaction.options.getString("price");
        const rating = interaction.options.getInteger("rating");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        if (rating < 1 || rating > 5)
            return interaction.reply({ content: "Rating must be between 1 and 5.", ephemeral: true });

        const stars = "⭐".repeat(rating) + ` (${rating}/5)`;
        const vouchID = Math.random().toString(36).substring(2, 8).toUpperCase();

        // PROPER DISCORD MENTION FORMAT
        const sellerMention = `<@${seller.id}>`;
        const voucherMention = `<@${interaction.user.id}>`;

        const embed = new EmbedBuilder()
            .setColor("#2B2D31")
            .setTitle("💗 • New Vouch Recorded!")
            .addFields(
                { name: "🛒 Product", value: product, inline: true },
                { name: "💲 Price", value: price, inline: true },
                { name: "👤 Seller", value: sellerMention, inline: false },
                { name: "⭐ Rating", value: stars, inline: false },
                { name: "📝 Reason", value: reason, inline: false },
                { name: "🙋 Vouched By", value: voucherMention, inline: true },
                { name: "🆔 Vouch ID", value: vouchID, inline: true }
            )
            .setFooter({ text: "Force Voucher" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Submit Review")
                .setStyle(ButtonStyle.Primary)
                .setCustomId("submit_review")
        );

        const channel = client.channels.cache.get(VOUCH_CHANNEL_ID);
        if (channel) {
            await channel.send({
                embeds: [embed],
                components: [row],
                allowedMentions: { parse: ["users"] }
            });
        }

        return interaction.reply({
            content: "Your vouch has been successfully submitted.",
            ephemeral: true
        });
    }

    // ================= ADMIN ROLE CHECK =================
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    }

    if (commandName === "clear") {
        const amount = interaction.options.getInteger("amount");
        await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: `Deleted ${amount} messages.`, ephemeral: true });
    }

    if (commandName === "ban") {
        const user = interaction.options.getUser("user");
        await interaction.guild.members.ban(user.id);
        return interaction.reply(`${user.tag} has been banned.`);
    }

    if (commandName === "unban") {
        const id = interaction.options.getString("userid");
        await interaction.guild.members.unban(id);
        return interaction.reply(`User has been unbanned.`);
    }

    if (commandName === "mute") {
        const member = interaction.options.getMember("user");
        await member.timeout(5 * 60000);
        return interaction.reply(`User muted for 5 minutes.`);
    }

    if (commandName === "unmute") {
        const member = interaction.options.getMember("user");
        await member.timeout(null);
        return interaction.reply(`Timeout removed.`);
    }

    if (commandName === "timeout") {
        const member = interaction.options.getMember("user");
        const minutes = interaction.options.getInteger("minutes");
        await member.timeout(minutes * 60000);
        return interaction.reply(`User timed out for ${minutes} minutes.`);
    }
});

require("http").createServer((req, res) => {
    res.end("Bot Running");
}).listen(3000);

client.login(process.env.TOKEN);
