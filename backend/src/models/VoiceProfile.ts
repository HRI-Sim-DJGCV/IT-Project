import { Schema, model } from "mongoose";

export interface IVoiceProfile {
  gender: string;
  age: string;
  tone: string;
}

const voiceProfileSchema = new Schema<IVoiceProfile>(
  {
    gender: { type: String, required: true },
    age: { type: String, required: true },
    tone: { type: String, required: true },
  },
  { timestamps: true }
);

export const VoiceProfile = model<IVoiceProfile>("VoiceProfile", voiceProfileSchema);
