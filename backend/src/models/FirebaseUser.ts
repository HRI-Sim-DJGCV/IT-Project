import { Schema, model } from "mongoose";


// NOTE: Deliberately do NOT store a password field.
// Firebase Authentication already stores and manages passwords 
export interface IFirebaseUser {
  _id: string; // the Firebase UID itself, not an auto-generated ObjectId
  email: string;
}

const firebaseUserSchema = new Schema<IFirebaseUser>(
  {
    _id: { type: String }, // we supply this ourselves (the Firebase UID)
    email: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
    _id: false, // tells Mongoose "don't auto-generate an _id, I'm providing one"
  }
);

export const FirebaseUser = model<IFirebaseUser>("FirebaseUser", firebaseUserSchema);
