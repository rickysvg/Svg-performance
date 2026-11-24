/**
 * Sets plugins.SVG.pushReady when google-services.json is present.
 * Android must not call PushNotifications.register() without Firebase.
 * Does not print or copy the json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "capacitor.config.json");
const services = path.join(root, "android/app/google-services.json");
const ready = fs.existsSync(services);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.plugins = config.plugins ?? {};
config.plugins.SVG = { ...(config.plugins.SVG ?? {}), pushReady: ready };
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(ready ? "Native push: Firebase config found. pushReady=true." : "Native push: no google-services.json. pushReady=false.");
