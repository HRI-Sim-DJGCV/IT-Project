import { Schema, model, Types } from "mongoose";

interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

const geoPointSchema = new Schema<GeoPoint>(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

export interface ILandmark {
  name: string;
  route: Types.ObjectId;
  facts: string[]; 
  coordinate: GeoPoint;
  bufferZone: number; // metres — how close a walker must be to "trigger" this landmark
}

const landmarkSchema = new Schema<ILandmark>(
  {
    name: { type: String, required: true },
    route: { type: Schema.Types.ObjectId, ref: "Route", required: true },
    facts: { type: [String], default: [] },
    coordinate: { type: geoPointSchema, required: true },
    bufferZone: { type: Number, default: 10 },
  },
  { timestamps: true }
);

landmarkSchema.index({ coordinate: "2dsphere" });

export const Landmark = model<ILandmark>("Landmark", landmarkSchema);
