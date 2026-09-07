import { Schema, model, Types } from "mongoose";

export interface IAudioFile {
  scriptSegment: Types.ObjectId;
  voiceProfile: Types.ObjectId;
  url: string;
  duration: number; // seconds
}

const audioFileSchema = new Schema<IAudioFile>(
  {
    scriptSegment: { type: Schema.Types.ObjectId, ref: "ScriptSegment", required: true },
    voiceProfile: { type: Schema.Types.ObjectId, ref: "VoiceProfile", required: true },
    url: { type: String, required: true },
    duration: { type: Number, required: true },
  },
  { timestamps: true }
);

export const AudioFile = model<IAudioFile>("AudioFile", audioFileSchema);
