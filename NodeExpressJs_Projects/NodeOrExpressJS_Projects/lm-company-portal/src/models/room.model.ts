import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRoom extends Document {
  roomName: string;
  capacity: number;
  floor: number;
  building: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    roomName:    { type: String, required: true, unique: true },
    capacity:    { type: Number, required: true, min: 1 },
    floor:       { type: Number, required: true },
    building:    { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

export const Room: Model<IRoom> = mongoose.model<IRoom>('Room', RoomSchema);
