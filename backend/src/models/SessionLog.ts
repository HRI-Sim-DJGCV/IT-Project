import { Schema, model, Types } from "mongoose";

export interface ISessionLog {
  walk: Types.ObjectId;
  completionStatus: string;
  emotionsBefore: string;
  emotionsAfter: string;
  deviationMetres: number;
  pace: string;
}

const sessionLogSchema = new Schema<ISessionLog>(
  {
    walk: { type: Schema.Types.ObjectId, ref: "Walk", required: true },
    completionStatus: { type: String, required: true },
    emotionsBefore: String,
    emotionsAfter: String,
    deviationMetres: { type: Number, default: 0 },
    pace: String,
  },
  { timestamps: true }
);

export const SessionLog = model<ISessionLog>("SessionLog", sessionLogSchema);
