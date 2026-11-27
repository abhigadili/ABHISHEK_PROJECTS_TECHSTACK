// ============================================================
// WHAT: Mongoose schema/model for the users collection
// WHY:  Mongoose schema enforces structure at the application layer.
//       MongoDB itself is schema-less, so Mongoose fills that gap.
// Security Consideration: password is never returned in API responses.
//                         Use .select('-password') in queries.
// Interview Tip: pre('save') hooks run BEFORE the document is saved.
//               Use them for hashing, auditing, normalising data.
// ============================================================

import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Role, ROLES } from '../constants';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;           // undefined for OAuth users
  role: Role;
  isActive: boolean;
  // OAuth fields (optional — only set when AUTH_PROVIDER=oauth2)
  provider?: 'local' | 'google' | 'github';
  providerId?: string;
  avatar?: string;
  // Password reset
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  // Timestamps (added by Mongoose timestamps option)
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    firstName:  { type: String, required: true, trim: true },
    lastName:   { type: String, required: true, trim: true },
    // Index on email for fast login lookups (unique prevents duplicates)
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false → Mongoose will NOT include password in query results by default
    // Best Practice: always use select: false for sensitive fields
    password:   { type: String, select: false },
    role:       { type: String, enum: Object.values(ROLES), default: ROLES.EMPLOYEE },
    isActive:   { type: Boolean, default: true },
    provider:   { type: String, enum: ['local', 'google', 'github'], default: 'local' },
    providerId: { type: String },
    avatar:     { type: String },
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
    // Remove __v (internal Mongoose version key) from responses
    versionKey: false,
  }
);

// ---- Pre-save hook: hash password ----
// WHY: Plain-text passwords must NEVER be stored.
// HOW: bcrypt applies a salt + hash (cost factor 12 = ~250ms per hash,
//      which makes brute-force attacks impractical).
// Interview Tip: The pre('save') hook only runs on document.save(), not
//               on Model.updateOne(). Use pre('save') for business logic.
UserSchema.pre<IUser>('save', async function (next) {
  // Only re-hash if the password field was changed
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ---- Instance method: compare password ----
UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
