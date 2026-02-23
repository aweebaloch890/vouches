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

const commands = [
    new SlashCommandBuilder()
        .setName("restock")
        .setDescription("Create Restock")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    await rest.put(
        Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            process.env.GUILD_ID
        ),
        { body: commands }
    );
    console.log("Slash command registered ✅");
})();

client.on("interactionCreate", async interaction => {

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
                .setLabel("Image URL")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const channel = new TextInputBuilder()
                .setCustomId("channel")
                .setLabel("Target Channel ID")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const variants = new TextInputBuilder()
                .setCustomId("variants")
                .setLabel("Variants (Name,Price,Stock per line)")
                .setStyle(TextInputStyle.Paragraph)
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

    if (interaction.isModalSubmit()) {

        if (interaction.customId === "restock_modal") {

            const productName = interaction.fields.getTextInputValue("product");
            const imageURL = interaction.fields.getTextInputValue("image");
            const channelId = interaction.fields.getTextInputValue("channel");
            const variantInput = interaction.fields.getTextInputValue("variants");

            const parsedVariants = variantInput.split("\n").map(line => {
                const [name, price, stock] = line.split(",");
                return {
                    name: name.trim(),
                    price: price.trim(),
                    stock: parseInt(stock.trim())
                };
            });

            products[productName] = {
                image: imageURL,
                variants: parsedVariants,
                channelId
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

            const channel = await client.channels.fetch(channelId);
            const msg = await channel.send({
                embeds: [embed],
                components: [row]
            });

            products[productName].messageId = msg.id;
            saveProducts();

            await interaction.reply({
                content: "Restock Created ✅",
                ephemeral: true
            });
        }
    }

    if (interaction.isButton()) {

        if (interaction.customId.startsWith("buy_")) {

            const buyChannel = await client.channels.fetch(BUY_CHANNEL_ID);

            await interaction.reply({
                content: `Please go to ${buyChannel} to complete your purchase.`,
                ephemeral: true
            });
        }

        if (interaction.customId.startsWith("edit_")) {

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                return interaction.reply({ content: "Admin only ❌", ephemeral: true });

            const productName = interaction.customId.replace("edit_", "");

            const modal = new ModalBuilder()
                .setCustomId(`edit_modal_${productName}`)
                .setTitle("Edit Stock");

            const stockInput = new TextInputBuilder()
                .setCustomId("variants")
                .setLabel("Variants (Name,Price,Stock per line)")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(stockInput));

            await interaction.showModal(modal);
        }
    }

});

// ===== SAME CLEAN EMBED STYLE =====
function generateEmbed(productName) {

    const product = products[productName];

    let description = `
--------------------------------------------------------
${productName} Restocked
--------------------------------------------------------

Our product ${productName} has just been restocked!

Buy Now

`;

    product.variants.forEach(v => {

        description += `
--------------------------------------------------------
Variant                                 Price                  Stock
${v.name.padEnd(25, " ")}${v.price.padEnd(15, " ")}${v.stock}
--------------------------------------------------------
`;
    });

    return new EmbedBuilder()
        .setColor("#2b2d31")
        .setDescription(description)
        .setImage(product.image)
        .setTimestamp();
}

client.login(process.env.TOKEN);
