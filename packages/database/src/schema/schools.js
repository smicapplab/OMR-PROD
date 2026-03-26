"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.machineAssignments = exports.machines = exports.schools = exports.regions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.regions = (0, pg_core_1.pgTable)('regions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull().unique(),
    code: (0, pg_core_1.varchar)('code', { length: 50 }).unique(),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.schools = (0, pg_core_1.pgTable)('schools', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    code: (0, pg_core_1.varchar)('code', { length: 50 }).notNull().unique(),
    regionId: (0, pg_core_1.uuid)('region_id').references(() => exports.regions.id, { onDelete: 'set null' }),
    division: (0, pg_core_1.varchar)('division', { length: 100 }),
    address: (0, pg_core_1.text)('address'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.machines = (0, pg_core_1.pgTable)('machines', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    machineId: (0, pg_core_1.varchar)('machine_id', { length: 255 }).notNull().unique(),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).default('pending').notNull(),
    secret: (0, pg_core_1.varchar)('secret', { length: 255 }),
    enrollmentToken: (0, pg_core_1.varchar)('enrollment_token', { length: 255 }),
    hostname: (0, pg_core_1.varchar)('hostname', { length: 255 }),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 50 }),
    lastHeartbeatAt: (0, pg_core_1.timestamp)('last_heartbeat_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.machineAssignments = (0, pg_core_1.pgTable)('machine_assignments', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    machineId: (0, pg_core_1.uuid)('machine_id').notNull().references(() => exports.machines.id, { onDelete: 'cascade' }),
    scope: (0, pg_core_1.varchar)('scope', { length: 50 }).notNull().default('SCHOOL'),
    scopeValue: (0, pg_core_1.uuid)('scope_value').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=schools.js.map