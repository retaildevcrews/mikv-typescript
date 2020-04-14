import "reflect-metadata";
import * as swaggerJSDoc from "swagger-jsdoc";
import { InversifyRestifyServer } from "inversify-restify-utils";
import { SecretController } from "./controllers/SecretController";
import { BunyanLogService, LogService } from "./services";
import { Container } from "inversify";
import { ConsoleController } from "./config/ConsoleController";
import { html } from "./swagger-html";
import { ConfigValues } from "./config/ConfigValues";
import { interfaces, TYPE } from "inversify-restify-utils";
import { version } from "./config/constants";
import bodyParser = require("body-parser");
import restify = require("restify");

// main
(async function main() {
    const container: Container = new Container();

    // setup logService (we need it for configuration)
    container.bind<LogService>("LogService").to(BunyanLogService).inSingletonScope();
    const logService = container.get<LogService>("LogService");
    
    // parse command line arguments to get the key vault url and auth type
    const consoleController = new ConsoleController(logService);
    const config = await consoleController.run();

    // setup ioc container
    container.bind<ConfigValues>("ConfigValues").toConstantValue(config);
    container.bind<interfaces.Controller>(TYPE.Controller).to(SecretController).whenTargetNamed("SecretController");

    // create restify server
    const server = new InversifyRestifyServer(container);

    logService.info("Version: " + version);

    try {
        // listen for requests
        server.setConfig(app => {
            // middleware
            app
                .use(bodyParser.urlencoded({ extended: true }))
                .use(restify.plugins.queryParser({ mapParams: false }))
                .use(bodyParser.json())
                .use(restify.plugins.requestLogger());

            const options: any = {
                // Path to the API docs
                apis: [`${__dirname}/models/*.js`, `${__dirname}/controllers/*.js`],
                definition: {
                    info: {
                        title: "Helium", // Title (required)
                        version: {version}, // Version (required)
                    },
                    openapi: "3.0.2", // Specification (optional, defaults to swagger: "2.0")
                },
            };

            // Initialize swagger-jsdoc -> returns validated swagger spec in json format
            const swaggerSpec: any = swaggerJSDoc(options);

            app.get("/swagger.json", (req, res) => {
                res.setHeader("Content-Type", "application/json");
                res.send(swaggerSpec);
            });

            app.get("/", (req, res) => {
                res.writeHead(200, {
                    "Content-Length": Buffer.byteLength(html),
                    "Content-Type": "text/html",
                });
                res.write(html);
                res.end();
            });

            app.get("/node_modules/swagger-ui-dist/*", restify.plugins.serveStatic({
                directory: __dirname + "/..",
            }));

            app.get("/version", (req, res) => {
                res.setHeader("Content-Type", "text/plain");
                res.send(version);
            });
        }).build().listen(config.port, () => {
            logService.info("Server is listening on port " + config.port);
        });
    } catch (err) {
        logService.error(Error(err), "Error setting up the server" + err);
    }
})()
