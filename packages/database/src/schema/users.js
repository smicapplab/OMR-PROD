"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userMachines = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const schools_1 = require("./schools");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    schoolId: (0, pg_core_1.uuid)('school_id').references(() => schools_1.schools.id, { onDelete: 'cascade' }),
    email: (0, pg_core_1.varchar)('email', { length: 320 }).notNull(),
    passwordHash: (0, pg_core_1.varchar)('password_hash', { length: 255 }),
    firstName: (0, pg_core_1.varchar)('first_name', { length: 255 }),
    lastName: (0, pg_core_1.varchar)('last_name', { length: 255 }),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    userType: (0, pg_core_1.varchar)('user_type', { length: 50 }).default('EDGE_OPERATOR').notNull(),
    visibilityScope: (0, pg_core_1.varchar)('visibility_scope', { length: 50 }).default('SCHOOL').notNull(),
    scopeValue: (0, pg_core_1.varchar)('scope_value', { length: 255 }),
    lastLoginAt: (0, pg_core_1.timestamp)('last_login_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    emailUq: (0, pg_core_1.uniqueIndex)('users_email_uq').on(t.email),
    schoolIdx: (0, pg_core_1.index)('users_school_id_idx').on(t.schoolId),
    activeIdx: (0, pg_core_1.index)('users_is_active_idx').on(t.isActive),
}));
exports.userMachines = (0, pg_core_1.pgTable)('user_machines', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    machineId: (0, pg_core_1.uuid)('machine_id').notNull().references(() => schools_1.machines.id, { onDelete: 'cascade' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=users.js.map