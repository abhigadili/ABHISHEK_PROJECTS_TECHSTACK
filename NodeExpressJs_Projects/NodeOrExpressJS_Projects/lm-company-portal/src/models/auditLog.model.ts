import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User' },
    action:     { type: String, required: true }, // e.g. 'CREATE_EMPLOYEE'
    resource:   { type: String, required: true }, // e.g. 'Employee'
    resourceId: { type: String },
    changes:    { type: Schema.Types.Mixed },     // before/after snapshot
    ip:         { type: String },
    userAgent:  { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// TTL index: auto-delete audit logs older than 1 year (31536000 seconds)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
