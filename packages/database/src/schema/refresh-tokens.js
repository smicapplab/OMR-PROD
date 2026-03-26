"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokens = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.refreshTokens = (0, pg_core_1.pgTable)('refresh_tokens', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => users_1.users.id, { onDelete: 'cascade' }),
    tokenHash: (0, pg_core_1.varchar)('token_hash', { length: 255 }).notNull(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    userIdx: (0, pg_core_1.index)('tokens_user_idx').on(t.userId),
}));
//# sourceMappingURL=refresh-tokens.js.map