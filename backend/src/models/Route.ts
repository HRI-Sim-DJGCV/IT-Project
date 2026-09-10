import { Schema, model, Types } from "mongoose";

// A small reusable shape for storing map coordinates. 
interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

const geoPointSchema = new Schema<GeoPoint>(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

export interface IRoute {
  walk: Types.ObjectId;
  startCoordinate: GeoPoint;
  endCoordinate: GeoPoint;
  distance: number; // metres
  expectedDuration: number; // minutes
}

const routeSchema = new Schema<IRoute>(
  {
    walk: { type: Schema.Types.ObjectId, ref: "Walk", required: true },
    startCoordinate: { type: geoPointSchema, required: true },
    endCoordinate: { type: geoPointSchema, required: true },
    distance: { type: Number, required: true },
    expectedDuration: { type: Number, required: true },
  },
  { timestamps: true }
);

routeSchema.index({ startCoordinate: "2dsphere" });

export const Route = model<IRoute>("Route", routeSchema);
