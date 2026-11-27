import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMeeting extends Document {
  title: string;
  roomId: Types.ObjectId;
  bookedBy: Types.ObjectId;
  attendees: Types.ObjectId[];
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'cancelled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const MeetingSchema = new Schema<IMeeting>(
  {
    title:     { type: String, required: true },
    roomId:    { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    bookedBy:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    attendees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    startTime: { type: Date, required: true },
    endTime:   { type: Date, required: true },
    status:    { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' },
  },
  { timestamps: true, versionKey: false }
);

// Index for finding room bookings in a time range
MeetingSchema.index({ roomId: 1, startTime: 1, endTime: 1 });

export const Meeting: Model<IMeeting> = mongoose.model<IMeeting>('Meeting', MeetingSchema);
