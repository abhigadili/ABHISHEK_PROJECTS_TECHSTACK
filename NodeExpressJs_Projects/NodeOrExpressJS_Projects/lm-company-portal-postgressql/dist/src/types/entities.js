"use strict";
// ============================================================
// WHAT: Plain TypeScript interfaces for PostgreSQL row types
// WHY:  No Mongoose Document needed. PostgreSQL rows map directly
//       to plain objects. The `pg` library returns plain JS objects.
// Interview Tip: With SQL ORMs (TypeORM, Sequelize) you'd use
//               decorated classes. With raw pg, plain interfaces suffice.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
