require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    SlashCommandBuilder,
    REST,
    Routes,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const BUY_CHANNEL_ID = "1337266092812406844";
const DATA_FILE = path.join(__dirname, "products.json");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

let products = {};
if (fs.existsSync(DATA_FILE)) {
    products = JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveProducts() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}

/* ================= EMBED GENERATOR ================= */
function generateEmbed(productName) {

    const data = products[productName];
    if (!data)
        return new EmbedBuilder().setDescription("Product not found");

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(`${productName} Restocked! 🔥`)
        .setURL("https://discord.com/channels/1337111106971504661/1337266092812406844")
        .setDescription(
            `Our product **${productName}** has just been **restocked**!\n` +
            `Jaldi se grab kar lo – stock limited hai! 🚀\n\n` +
            `**Buy Now / Open Ticket → Click the title above!**`
        )
        .setThumbnail("https://cdn.discordapp.com/attachments/1337788828051701873/1475668721010741248/tec_trader-removebg-preview_1.png")
        .setFooter({
            text: "Tec Trader • Restock Alert",
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();

    // SAFE IMAGE SET
    if (data.image && data.image.startsWith("http")) {
        embed.setImage(data.image);
    }

    // variants table
    data.variants.forEach((v, index) => {

        embed.addFields(
            { name: "Variant", value: v.name, inline: true },
            { name: "Price", value: v.price, inline: true },
            { name: "Stock", value: String(v.stock), inline: true }
        );

        if (index < data.variants.length - 1) {
            embed.addFields({ name: "\u200B", value: "\u200B" });
        }
    });

    return embed;
}

/* ================= SLASH COMMAND ================= */
const commands = [
    new SlashCommandBuilder()
        .setName("restock")
        .setDescription("Create Restock Announcement")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );
        console.log("Slash command /restock registered ✅");
    } catch (err) {
        console.error(err);
    }
})();

/* ================= INTERACTIONS ================= */
client.on("interactionCreate", async interaction => {
    /* ===== SLASH COMMAND ===== */
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "restock") {
            const modal = new ModalBuilder()
                .setCustomId("restock_modal")
                .setTitle("Create Restock");

            const product = new TextInputBuilder()
                .setCustomId("product")
                .setLabel("Product Name")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const image = new TextInputBuilder()
                .setCustomId("image")
                .setLabel("Image URL (product box)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const channel = new TextInputBuilder()
                .setCustomId("channel")
                .setLabel("Target Channel ID")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const variants = new TextInputBuilder()
                .setCustomId("variants")
                .setLabel("Variants (one per line: Name,Price,Stock)")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("1K Followers,€3.00,16\n1K Likes,€2.50,8\n1K Views,€2.50,8")
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(product),
                new ActionRowBuilder().addComponents(image),
                new ActionRowBuilder().addComponents(channel),
                new ActionRowBuilder().addComponents(variants)
            );

            await interaction.showModal(modal);
        }
    }

    /* ===== MODAL SUBMIT → CREATE RESTOCK ===== */
    if (interaction.isModalSubmit() && interaction.customId === "restock_modal") {
        await interaction.deferReply({ ephemeral: true });

        const productName = interaction.fields.getTextInputValue("product").trim();
        const imageURL    = interaction.fields.getTextInputValue("image").trim();
        const channelId   = interaction.fields.getTextInputValue("channel").trim();
        const variantInput = interaction.fields.getTextInputValue("variants");

        const parsedVariants = variantInput
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                const [name, price, stockStr] = line.split(",").map(part => part.trim());
                const stock = parseInt(stockStr);
                return {
                    name: name || "Unknown",
                    price: price || "€0.00",
                    stock: isNaN(stock) ? 0 : stock
                };
            });

        products[productName] = {
            image: imageURL,
            variants: parsedVariants,
            channelId,
            createdAt: Date.now()
        };
        saveProducts();

        const embed = generateEmbed(productName);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`buy_${productName}`)
                .setLabel("Buy Now")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`edit_${productName}`)
                .setLabel("Edit Stock")
                .setStyle(ButtonStyle.Secondary)
        );

        try {
            const channel = await client.channels.fetch(channelId);
            const msg = await channel.send({
                embeds: [embed],
                components: [row]
            });

            products[productName].messageId = msg.id;
            saveProducts();

            await interaction.editReply("Restock Created Successfully ✅");
        } catch (err) {
            console.error(err);
            await interaction.editReply("Error: Channel not found or no permission ❌");
        }
    }

    /* ===== BUTTONS ===== */
    if (interaction.isButton()) {
        if (interaction.customId.startsWith("buy_")) {
            const buyChannel = await client.channels.fetch(BUY_CHANNEL_ID).catch(() => null);
            return interaction.reply({
                content: buyChannel 
                    ? `Please go to ${buyChannel} to complete your purchase.`
                    : "Buy channel not found.",
                ephemeral: true
            });
        }

        if (interaction.customId.startsWith("edit_")) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: "Admin only ❌", ephemeral: true });
            }

            const productName = interaction.customId.replace("edit_", "");
            if (!products[productName]) {
                return interaction.reply({ content: "Product not found ❌", ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`edit_modal_${productName}`)
                .setTitle(`Edit Stock → ${productName}`);

            const stockInput = new TextInputBuilder()
                .setCustomId("variants")
                .setLabel("Variants (Name,Price,Stock per line)")
                .setStyle(TextInputStyle.Paragraph)
                .setValue(
                    products[productName].variants
                        .map(v => `${v.name},${v.price},${v.stock}`)
                        .join("\n")
                )
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(stockInput));

            await interaction.showModal(modal);
        }
    }

    /* ===== EDIT MODAL SUBMIT ===== */
    if (interaction.isModalSubmit() && interaction.customId.startsWith("edit_modal_")) {
        await interaction.deferReply({ ephemeral: true });

        const productName = interaction.customId.replace("edit_modal_", "");
        if (!products[productName]) {
            return interaction.editReply("Product not found ❌");
        }

        const variantInput = interaction.fields.getTextInputValue("variants");
        const parsedVariants = variantInput
            .split("\n")
            .map(line => line.trim())
            .filter(line => line)
            .map(line => {
                const [name, price, stockStr] = line.split(",").map(p => p.trim());
                const stock = parseInt(stockStr);
                return {
                    name: name || "Unknown",
                    price: price || "€0.00",
                    stock: isNaN(stock) ? 0 : stock
                };
            });

        products[productName].variants = parsedVariants;
        saveProducts();

        const embed = generateEmbed(productName);
        const channel = await client.channels.fetch(products[productName].channelId).catch(() => null);

        if (channel && products[productName].messageId) {
            try {
                const message = await channel.messages.fetch(products[productName].messageId);
                await message.edit({ embeds: [embed] });
                await interaction.editReply("Stock Updated ✅");
            } catch (err) {
                console.error(err);
                await interaction.editReply("Stock updated, but couldn't edit old message.");
            }
        } else {
            await interaction.editReply("Stock updated, but message/channel not found.");
        }
    }
});

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag} | Ready to restock!`);
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(process.env.TOKEN);
