"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    const port = config.get('server.port', 3001);
    const allowedOrigins = config.get('frontend.urls', [
        'http://localhost:3000',
    ]);
    app.setGlobalPrefix('api');
    app.use((0, helmet_1.default)());
    app.enableCors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
        },
        methods: ['GET', 'POST', 'OPTIONS'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.enableShutdownHooks();
    await app.listen(port, '0.0.0.0');
    console.log(`MindRoute API listening on port ${port}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map