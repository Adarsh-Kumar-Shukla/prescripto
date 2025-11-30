import mongoose from "mongoose";

const { Schema } = mongoose;

const appointmentSchema = new Schema(
  {
    userId: { type: String, required: true },
    docId: { type: String, required: true },
    slotDate: { type: String, required: true },   // e.g. "28-11-2025"
    slotTime: { type: String, required: true },   // e.g. "10:30 am"
    docData: { type: Schema.Types.Mixed, required: false }, // accept object snapshot
    userData: { type: Schema.Types.Mixed, required: false }, // accept object snapshot
    amount: { type: Number, required: true },
    cancelled: { type: Boolean, default: false },
    payment: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true } // adds createdAt and updatedAt
);

const appointmentModel =
  mongoose.models.appointment || mongoose.model("appointment", appointmentSchema);

export default appointmentModel;
