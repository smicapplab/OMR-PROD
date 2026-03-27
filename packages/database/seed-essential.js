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
const bcrypt = __importStar(require("bcrypt"));
require("dotenv/config");
const connectionString = process.env.DATABASE_URL;
const client = (0, postgres_1.default)(connectionString);
const db = (0, postgres_js_1.drizzle)(client, { schema });
async function main() {
    console.log('--- Running Essential Seeding (Production) ---');
    const adminEmail = 'admin@omr-prod.gov.ph';
    const hashedPassword = await bcrypt.hash('password123', 10);
    const [admin] = await db.insert(schema.users).values({
        email: adminEmail,
        passwordHash: hashedPassword,
        userType: 'SUPER_ADMIN',
        firstName: 'System',
        lastName: 'Administrator',
        visibilityScope: 'NATIONAL',
        scopeValue: 'ALL'
    }).onConflictDoNothing().returning();
    if (admin) {
        console.log(`Super Admin created: ${adminEmail}`);
    }
    else {
        console.log(`Super Admin already exists.`);
    }
    const auditorEmail = 'auditor@omr-prod.gov.ph';
    const [auditor] = await db.insert(schema.users).values({
        email: auditorEmail,
        passwordHash: hashedPassword,
        userType: 'NATIONAL_AUDITOR',
        firstName: 'National',
        lastName: 'Auditor',
        visibilityScope: 'NATIONAL',
        scopeValue: 'ALL'
    }).onConflictDoNothing().returning();
    if (auditor) {
        console.log(`National Auditor created: ${auditorEmail}`);
    }
    console.log('Seeding Official 2026-V1 Answer Keys...');
    const subjects = ['math', 'english', 'science', 'filipino', 'ap'];
    for (const subject of subjects) {
        const perfectAnswers = {};
        for (let i = 1; i <= 40; i++) {
            perfectAnswers[i] = ['A', 'B', 'C', 'D'][(i - 1) % 4];
        }
        await db.insert(schema.answerKeys).values({
            examName: "National Admission Test",
            subject: subject,
            version: "2026-V1",
            answers: perfectAnswers,
        }).onConflictDoNothing();
    }
    console.log(`Provisioned ${subjects.length} subject keys.`);
    console.log('--- Essential Seeding Complete ---');
    process.exit(0);
}
main().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed-essential.js.map