import { Schema, model } from "mongoose";

export interface IUser {
  firebaseUID: string; // links to FirebaseUser._id 
  firstName: string;
  lastName: string;
  role: "walker" | "admin" | "creator";
  walkingSpeed: number; // metres per second
}

const userSchema = new Schema<IUser>(
  {
    firebaseUID: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: {
      type: String,
      enum: ["walker", "admin", "creator"],
      default: "walker",
    },
    walkingSpeed: { type: Number, default: 1.4 },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
