import { Schema, model, Types } from "mongoose";

export interface IScriptSegment {
  walk: Types.ObjectId;
  landmark: Types.ObjectId;
  text: string;
  order: number;
  lengthWords: number;
}

const scriptSegmentSchema = new Schema<IScriptSegment>(
  {
    walk: { type: Schema.Types.ObjectId, ref: "Walk", required: true },
    landmark: { type: Schema.Types.ObjectId, ref: "Landmark", required: true },
    text: { type: String, required: true },
    order: { type: Number, required: true },
    lengthWords: { type: Number, required: true },
  },
  { timestamps: true }
);

export const ScriptSegment = model<IScriptSegment>("ScriptSegment", scriptSegmentSchema);
