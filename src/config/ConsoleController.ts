import "reflect-metadata";
import { KeyVaultService, LogService } from "../services";
import commandLineArgs = require("command-line-args");
import commandLineUsage = require("command-line-usage");
import { sections } from "./cli-config";
import { mySecretName, portConstant, version } from "./constants";
import { ConfigValues } from "./ConfigValues";

export class ConsoleController {
    constructor(private logService: LogService) { }

    // capture cli arguments and fetch application configuration
    async run() : Promise<ConfigValues>{
        const { validationMessages, values } = this.parseArguments();

        // handle --help
        if (values.help) {
            this.showHelp();
            process.exit();
        }

        // handle invalid values
        else if (validationMessages.length > 0) {
            validationMessages.forEach(m => console.error(m));
            this.showHelp();
            process.exit(-1);
        }

        this.logService.setLogLevel(values["log-level"]);

        // get config values
        let config: ConfigValues;
        try {
            config = await this.getConfigValues(values["keyvault-name"], values["auth-type"]);
        } catch (err) {
            this.logService.error(err, `Key Vault Config Exception: ${err}`);
            process.exit(-1);
        }

        // dry run or return
        if (values["dry-run"]) {
            this.dryRun(config, values);
            process.exit();
        }
        return config;
    }

    public parseArguments(): {validationMessages: any[], values: any}{
        const options: OptionDefinition[] = sections.find(s => s.header == "Options").optionList;
        let args;

        // environment variables
        const env = {
            "keyvault-name": process.env.KEYVAULT_NAME,
            "auth-type": process.env.AUTH_TYPE,
            "log-level": process.env.LOG_LEVEL,
        }

        // command line arguments
        try {
            args = commandLineArgs(options);
        } catch(e) {
            this.showHelp(`Error: ${e.name}`);
            process.exit(-1);
        }

        // compose the two
        const values = { ...env, ...args };

        // set default values if no cli args or env vars provided
        if (!("auth-type" in args) && !values["auth-type"]) values["auth-type"] = "MSI";
        if (!("log-level" in args) && !values["log-level"]) values["log-level"] = "info";

        const validationMessages = [];

        // check required arguments
        options.filter(o => o.required && !values[o.name])
            .forEach(o => validationMessages.push(`Missing ${o.name} argument`));

        // check validation patterns
        options.filter(o => o.validationPattern && !o.validationPattern.test(values[o.name]))
            .forEach(o => validationMessages.push(`Value: "${values[o.name]}" for ${o.name} argument is not valid`));

        // expand keyvault URL
        if (values["keyvault-name"] && !values["keyvault-name"].startsWith("https://"))
            values["keyvault-name"] = `https://${values["keyvault-name"]}.vault.azure.net`;

        return { validationMessages: validationMessages, values: values };
    }

    showHelp(message?: string): void{
        if (message) console.log(message);
        console.log(commandLineUsage(sections));
    }

    dryRun(config: ConfigValues, values: any[]): void{
        console.log(`
            Version                       ${version}
            Keyvault                      ${values["keyvault-name"]}
            Auth Type                     ${values["auth-type"]}
            MySecret                      ${config.mySecret}
            Logging Level                 ${values["log-level"]}
        `);
    }

    async getConfigValues(keyVaultUrl: string, authType: string): Promise<ConfigValues> {

        // use default port from constants
        const port = portConstant;

        const keyvault = new KeyVaultService(keyVaultUrl, authType, this.logService);
        await keyvault.connect();

        // get secret from Key Vault
        const mySecret = await keyvault.getSecret(mySecretName);

        return {
            port,
            mySecret
        };
    }
}

export interface OptionDefinition {
    name: string;
    alias?: string;
    type?: any;
    description?: string;
    validationPattern?: RegExp;
    required?: boolean;
}
