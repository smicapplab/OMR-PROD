import { pgTable, uuid, varchar, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { schools } from './schools';

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
    
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    
    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    
    isActive: boolean('is_active').default(true).notNull(),
    userType: varchar('user_type', { length: 50 }).default('EDGE_OPERATOR').notNull(),
    
    // --- HIERARCHICAL ACCESS (For DepEd/HQ) ---
    // scope: NATIONAL | REGIONAL | DIVISION | SCHOOL
    visibilityScope: varchar('visibility_scope', { length: 50 }).default('SCHOOL').notNull(),
    // scopeValue: The name of the region, division, or school ID
    scopeValue: varchar('scope_value', { length: 255 }),

    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    });

    export const userMachines = pgTable('user_machines', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    machineId: uuid('machine_id').notNull().references(() => machines.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    });

    emailUq: uniqueIndex('users_email_uq').on(t.email),
    schoolIdx: index('users_school_id_idx').on(t.schoolId),
    activeIdx: index('users_is_active_idx').on(t.isActive),
}));
