// import mongoose from "mongoose";
import settings from "../settings";
import Client from "./structures/Client";
import CommandHandler from "./structures/CommandHandler";
import CommandLoader from "./structures/CommandLoader";
import Logger from "./utils/Logger";
import { promises as fs } from "fs";
import { isGuildChannel } from "./utils/Helpers";

import "./utils/Extended";

// Whether the bot is ready or not
let ready = false;

// Initialize discord client
const client = new Client(settings.token, {
    getAllUsers: true,
    restMode: true
});

// Initialize logger, command loader and command handler
const logger = new Logger();
const commandLoader = new CommandLoader(logger);
const commandHandler = new CommandHandler({ settings, client, logger });

async function main(): Promise<void> {
    // Load events
    const eventsDir = `${__dirname}/events`;
    const files = await fs.readdir(eventsDir);
    for (const file of files) {
        if (file.endsWith(".ts")) {
            const temp = await import(`${eventsDir}/${file}`);
            logger.info("EVENTS", `Loaded ${temp.event.name}`);
            client.on(temp.event.name, (...args) => temp.event.run(client, settings, args));
        }
    }

    client.on("ready", async () => {
        if (!ready) {
            // Connect to mongodb
            // await mongoose.connect(`mongodb://${settings.database.host}:${settings.database.port}/${settings.database.name}`, { useNewUrlParser: true });

            // Load commands
            client.commands = await commandLoader.load(`${__dirname}/commands`);

            // Log some info
            logger.ready(`Logged in as ${client.user.tag}`);
            logger.ready(`Loaded [${client.commands.size}] commands`);

            // We're ready \o/
            ready = true;
        }
    });

    // Handle disconnects
    client.on("disconnect", () => {
        logger.warn("DISCONNECT", "Client disconnected");
    });

    // Handle commands
    client.on("messageCreate", async (msg) => {
        if (!ready) return; // Bot not ready yet
        if (!msg.author) return; // Probably system message
        if (msg.author.discriminator === "0000") return; // Probably a webhook

        client.stats.messagesSeen++;

        // If message starts with our prefix check if it's a valid command, then execute the command if valid
        if (msg.content.startsWith(settings.prefix)) {
            if (isGuildChannel(msg.channel) && msg.author.id !== client.user.id) {
                await commandHandler.handleCommand(msg, false);
            } else if (msg.channel.type === 1) {
                await commandHandler.handleCommand(msg, true);
            }
        }
    });

    process.on("unhandledRejection", (reason) => {
        logger.error("UNHANDLED_REJECTION", reason);
    });

    process.on("SIGINT", () => {
        client.disconnect({ reconnect: false });
        process.exit(0);
    });

    // Connect to discord OwO
    client.connect().catch((e) => logger.error("CONNECT", e.stack));
}

main().catch((e) => logger.error("MAIN", e));
