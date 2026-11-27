import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICompany extends Document {
  name: string;
  address: string;
  email: string;
  phone: string;
  description?: string;
  website?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name:        { type: String, required: true, unique: true, trim: true },
    address:     { type: String, required: true },
    email:       { type: String, required: true, lowercase: true },
    phone:       { type: String, required: true },
    description: { type: String },
    website:     { type: String },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

// Text index enables full-text search across name and description
// Interview Tip: MongoDB text indexes support $text queries but are
//               not as powerful as Elasticsearch for full-text search.
CompanySchema.index({ name: 'text', description: 'text' });

export const Company: Model<ICompany> = mongoose.model<ICompany>('Company', CompanySchema);
