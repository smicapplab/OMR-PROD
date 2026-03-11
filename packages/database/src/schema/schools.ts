import { pgTable, uuid, varchar, timestamp, text } from 'drizzle-orm/pg-core';

export const regions = pgTable('regions', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(), // e.g. NCR, Region III
    code: varchar('code', { length: 50 }).unique(),           // e.g. REG-01
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const schools = pgTable('schools', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    
    // Geographical Hierarchy
    regionId: uuid('region_id').references(() => regions.id, { onDelete: 'set null' }),
    division: varchar('division', { length: 100 }), // e.g. Manila, Quezon City
    
    address: text('address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const machines = pgTable('machines', {
    id: uuid('id').defaultRandom().primaryKey(),
    machineId: varchar('machine_id', { length: 255 }).notNull().unique(),
    status: varchar('status', { length: 50 }).default('pending').notNull(),
    secret: varchar('secret', { length: 255 }), 
    enrollmentToken: varchar('enrollment_token', { length: 255 }),
    hostname: varchar('hostname', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 50 }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const machineAssignments = pgTable('machine_assignments', {
    id: uuid('id').defaultRandom().primaryKey(),
    machineId: uuid('machine_id').notNull().references(() => machines.id, { onDelete: 'cascade' }),
    scope: varchar('scope', { length: 50 }).notNull().default('SCHOOL'), // 'SCHOOL' or 'REGION'
    scopeValue: uuid('scope_value').notNull(), // UUID of the school or region
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
