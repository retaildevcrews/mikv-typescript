import { inject, injectable } from "inversify";
import { Controller, Get, interfaces } from "inversify-restify-utils";
import { Request } from "restify";
import * as HttpStatus from "http-status-codes";
import { LogService } from "../services/LogService";
import { ConfigValues } from "../config/ConfigValues";

// controller implementation for our genres endpoint
@Controller("/api/secret")
@injectable()
export class SecretController implements interfaces.Controller {

  constructor(@inject("ConfigValues") private config: ConfigValues, @inject("LogService") private logger: LogService) {
  
  }

  /**
   * @swagger
   *
   * /api/secret:
   *   get:
   *     description: Returns the secret stored in Key Vault
   *     tags:
   *       - Secret
   *     responses:
   *       '200':
   *         description: Returns text/plain secret value from Key Vault
   *       '500':
   *         description: Returns text/plain exception message
   */
  @Get("/")
  public async getSecret(req: Request, res) {
    res.setHeader("Content-Type", "text/plain");

    let result: string;
    try {
      result = this.config.mySecret;
    } catch (err) {
      this.logger.error(Error(err), "GetSecretExcption: " + err.toString());
      return res.send(HttpStatus.INTERNAL_SERVER_ERROR, "GetSecretExcption");
    }

    return res.send( HttpStatus.OK, result);
  }
}
