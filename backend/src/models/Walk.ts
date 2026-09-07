import { Schema, model, Types } from "mongoose";

export interface IWalk {
  user: Types.ObjectId;
  startTime?: Date;
  finishTime?: Date;
  expectedFinish?: Date;
  status: "not_started" | "in_progress" | "completed" | "abandoned";
  deviations: number;
}

const walkSchema = new Schema<IWalk>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startTime: Date,
    finishTime: Date,
    expectedFinish: Date,
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "abandoned"],
      default: "not_started",
    },
    deviations: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Walk = model<IWalk>("Walk", walkSchema);
