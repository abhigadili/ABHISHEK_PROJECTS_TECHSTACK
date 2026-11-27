import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IEmployee extends Document {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: Types.ObjectId;
  designation: string;
  managerId?: Types.ObjectId;
  salary: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employeeCode: { type: String, required: true, unique: true, uppercase: true },
    firstName:    { type: String, required: true },
    lastName:     { type: String, required: true },
    email:        { type: String, required: true, unique: true, lowercase: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    designation:  { type: String, required: true },
    managerId:    { type: Schema.Types.ObjectId, ref: 'Employee' }, // self-referencing
    salary:       { type: Number, required: true, min: 0 },
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

EmployeeSchema.index({ departmentId: 1 });
EmployeeSchema.index({ email: 1 });

export const Employee: Model<IEmployee> = mongoose.model<IEmployee>('Employee', EmployeeSchema);
