"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const schema = __importStar(require("./src/schema"));
require("dotenv/config");
const connectionString = process.env.DATABASE_URL;
const client = (0, postgres_1.default)(connectionString);
const db = (0, postgres_js_1.drizzle)(client);
async function main() {
    console.log('--- 🗺 Seeding Regions ---');
    const regions = [
        { name: 'NCR', code: 'NCR', description: 'National Capital Region' },
        { name: 'CAR', code: 'CAR', description: 'Cordillera Administrative Region' },
        { name: 'Region I', code: 'REG-1', description: 'Ilocos Region' },
        { name: 'Region II', code: 'REG-2', description: 'Cagayan Valley' },
        { name: 'Region III', code: 'REG-3', description: 'Central Luzon' },
        { name: 'Region IV-A', code: 'REG-4A', description: 'CALABARZON' },
        { name: 'MIMAROPA', code: 'REG-4B', description: 'Southwestern Tagalog Region' },
        { name: 'Region V', code: 'REG-5', description: 'Bicol Region' },
        { name: 'Region VI', code: 'REG-6', description: 'Western Visayas' },
        { name: 'Region VII', code: 'REG-7', description: 'Central Visayas' },
        { name: 'Region VIII', code: 'REG-8', description: 'Eastern Visayas' },
        { name: 'Region IX', code: 'REG-9', description: 'Zamboanga Peninsula' },
        { name: 'Region X', code: 'REG-10', description: 'Northern Mindanao' },
        { name: 'Region XI', code: 'REG-11', description: 'Davao Region' },
        { name: 'Region XII', code: 'REG-12', description: 'SOCCSKSARGEN' },
        { name: 'Region XIII', code: 'REG-13', description: 'Caraga' },
        { name: 'BARMM', code: 'BARMM', description: 'Bangsamoro Autonomous Region in Muslim Mindanao' },
    ];
    for (const reg of regions) {
        await db.insert(schema.regions).values({
            name: reg.name,
            code: reg.code,
            description: reg.description
        }).onConflictDoNothing();
    }
    console.log('--- ✅ Regions Seeded ---');
    process.exit(0);
}
main().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed-regions.js.map