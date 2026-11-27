import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  description?: string;
  companyId: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String },
    // ref: 'Company' tells Mongoose which model to populate for joins
    // Interview Tip: MongoDB doesn't enforce foreign keys. Mongoose .populate()
    //               does a second query — it's not a SQL JOIN.
    companyId:   { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

// Compound index: name must be unique within a company
DepartmentSchema.index({ name: 1, companyId: 1 }, { unique: true });

export const Department: Model<IDepartment> = mongoose.model<IDepartment>('Department', DepartmentSchema);
