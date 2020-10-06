import path from "path";
import Command from "./Command";
import Client from "./Client";
import Logger from "./Logger";
import Collection from "@kurozero/collection";
import { promises as fs } from "fs";

export default class CommandLoader {
    commands: Collection<Command>;
    client: Client;
    logger: Logger;

    constructor(client: Client) {
        this.commands = new Collection(Command);
        this.client = client;
        this.logger = client.logger;
    }

    /** Load all the commands */
    async load(commandDir: string): Promise<Collection<Command>> {
        const dirs = await fs.readdir(commandDir);
        for (const dir of dirs) {
            if (dir.endsWith(".disabled")) {
                continue;
            }
            const files = await fs.readdir(path.join(commandDir, dir));
            for (const file of files) {
                if (/\.disabled\.(j|t)s$/iu.test(file)) {
                    continue;
                } else if (/\.(j|t)s$/iu.test(file)) {
                    await this._add(path.join(commandDir, dir, file), dir);
                }
            }
        }
        return this.commands;
    }

    private async _add(commandPath: string, category: string): Promise<void> {
        try {
            const command = new (await import(commandPath)).default({ client: this.client, category }) as Command;
            if (this.commands.has(command.name)) {
                return this.logger.warn("COMMAND_HANDLER", `A command with the name ${command.name} already exists and has been skipped`);
            }
            this.commands.add(command);
            this.logger.info("COMMAND_HANDLER", `Loaded command ${command.name}`);
        } catch (e) {
            this.logger.warn("COMMAND_HANDLER", `${commandPath} - ${e.stack}`);
        }
    }
}
