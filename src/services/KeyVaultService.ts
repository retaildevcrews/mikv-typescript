import { SecretClient } from "@azure/keyvault-secrets";
import { inject, injectable } from "inversify";
import { LogService } from "./LogService";
import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";
import azureIdentity = require("@azure/identity");

// handles accessing secrets from Azure Key vault.
@injectable()
export class KeyVaultService {
    private client: SecretClient;

    // creates a new instance of the KeyVaultService class
    constructor(private url: string, private authType: string, @inject("LogService") private logger: LogService) {}

    // returns the latest version of the name's secret.
    public async getSecret(name: string): Promise<string> {

        try {
            const { value: secret } = await this.client.getSecret(name);
            return secret as string;
        } catch (e) {
            throw new Error(`Unable to find secret ${name}`);
        }
    }

    // connect to the Key Vault client
    public async connect(): Promise<void>{
        try {
            // use specified authentication type (either MSI or CLI)
            const creds: any = this.authType === "MSI" ?
                new azureIdentity.ManagedIdentityCredential() :
                await msRestNodeAuth.AzureCliCredentials.create({ resource: "https://vault.azure.net" });

            this.client = new SecretClient(this.url, creds);

            return;
        } catch (e) {
            throw new Error("Failed to connect to Key Vault with MSI");
        }
    }
}
