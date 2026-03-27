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
const users_1 = require("./src/schema/users");
const bcrypt = __importStar(require("bcrypt"));
require("dotenv/config");
const drizzle_orm_1 = require("drizzle-orm");
const connectionString = process.env.DATABASE_URL;
const client = (0, postgres_1.default)(connectionString);
const db = (0, postgres_js_1.drizzle)(client);
async function main() {
    console.log('--- 🧪 Running Expanded Realistic Demo Seeding ---');
    const regions = await db.select().from(schema.regions);
    const findId = (name) => regions.find(r => r.name === name)?.id;
    const findByCode = (code) => regions.find(r => r.code === code)?.id;
    const schoolsToInsert = [
        { name: 'Manila Science High School', code: '305312', regionId: findId('NCR'), division: 'Manila', address: 'Taft Ave, Manila' },
        { name: 'Philippine Science HS (Main)', code: '300401', regionId: findId('NCR'), division: 'Quezon City', address: 'Agham Road, QC' },
        { name: 'Test School Alpha', code: '777888', regionId: findId('NCR'), division: 'Manila', address: 'Test Site 1' },
        { name: 'Test School Beta', code: '123456', regionId: findId('NCR'), division: 'Manila', address: 'Test Site 2' },
        ...Array.from({ length: 15 }).map((_, i) => ({
            name: `Public School Instance ${i + 1}`,
            code: `900${100 + i}`,
            regionId: findId('NCR'),
            division: 'Generic Division',
            address: 'Standard DepEd Address Structure'
        }))
    ];
    console.log(`Inserting ${schoolsToInsert.length} Institutions...`);
    for (const s of schoolsToInsert) {
        await db.insert(schema.schools).values(s).onConflictDoNothing();
    }
    console.log('Provisioning Multi-Role Identities...');
    const salt = await bcrypt.genSalt(10);
    const pass = await bcrypt.hash('password123', salt);
    const [msSci] = await db.select().from(schema.schools).where((0, drizzle_orm_1.eq)(schema.schools.code, '305312')).limit(1);
    const [tsAlpha] = await db.select().from(schema.schools).where((0, drizzle_orm_1.eq)(schema.schools.code, '777888')).limit(1);
    const [tsBeta] = await db.select().from(schema.schools).where((0, drizzle_orm_1.eq)(schema.schools.code, '123456')).limit(1);
    const testUsers = [
        { email: 'auditor@omr-prod.gov.ph', firstName: 'Arthur', lastName: 'Auditor', userType: 'NATIONAL_AUDITOR', visibilityScope: 'NATIONAL', scopeValue: 'ALL' },
        { email: 'monitor.ncr@omr-prod.gov.ph', firstName: 'Nora', lastName: 'NCR', userType: 'DEPED_MONITOR', visibilityScope: 'REGIONAL', scopeValue: findByCode('NCR') },
        { email: 'admin.777@omr-prod.gov.ph', firstName: 'Admin', lastName: '777', userType: 'SCHOOL_ADMIN', schoolId: msSci.id, visibilityScope: 'SCHOOL', scopeValue: msSci.id },
        { email: 'operator1@mshs.edu.ph', firstName: 'MSHS', lastName: 'Operator 1', userType: 'EDGE_OPERATOR', visibilityScope: 'SCHOOL', scopeValue: msSci.id }
    ];
    for (const u of testUsers) {
        await db.insert(schema.users).values({ ...u, passwordHash: pass, isActive: true }).onConflictDoNothing();
    }
    console.log('Pre-enrolling MACHINE-00001...');
    const devMachineSecret = 'dev-machine-secret-123';
    const hashedMachineSecret = await bcrypt.hash(devMachineSecret, salt);
    const [devMachine] = await db.insert(schema.machines).values({
        machineId: 'MACHINE-00001',
        status: 'active',
        secret: hashedMachineSecret,
        hostname: 'dev-laptop',
        ipAddress: '127.0.0.1'
    }).onConflictDoNothing().returning();
    if (devMachine) {
        await db.delete(schema.machineAssignments).where((0, drizzle_orm_1.eq)(schema.machineAssignments.machineId, devMachine.id));
        await db.insert(schema.machineAssignments).values([
            { machineId: devMachine.id, scope: 'SCHOOL', scopeValue: msSci.id },
            { machineId: devMachine.id, scope: 'SCHOOL', scopeValue: tsAlpha.id },
            { machineId: devMachine.id, scope: 'SCHOOL', scopeValue: tsBeta.id }
        ]);
        const [op1] = await db.select().from(schema.users).where((0, drizzle_orm_1.eq)(schema.users.email, 'operator1@mshs.edu.ph')).limit(1);
        if (op1) {
            await db.insert(users_1.userMachines).values({
                userId: op1.id,
                machineId: devMachine.id
            }).onConflictDoNothing();
        }
        console.log('✅ MACHINE-00001 pre-authorized for multiple schools and personnel');
    }
    console.log('Provisioning PENDING machine for demo...');
    await db.insert(schema.machines).values({
        machineId: 'MACHINE-DEMO-PENDING',
        status: 'pending',
        secret: 'pending-secret-xyz',
        hostname: 'demo-unauthorized-box',
        ipAddress: '192.168.1.50'
    }).onConflictDoNothing();
    console.log('--- ✅ Demo Seeding Complete ---');
    process.exit(0);
}
main().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed-demo.js.map