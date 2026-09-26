import { VESSELS as RAW, vesselFor as rawVesselFor } from "./vessels-data.mjs";

/** Typed view of src/looks/vessels-data.mjs (the geometry lives there, shared with the tests). */
export interface Vessel {
  file: string;
  masks: string[];
  seeds: { x: number; y: number }[]; // inside each glass (mask flood-fill start)
  interiorTop: number; // y of the inside's top / bottom (level 0..1 is measured between them)
  interiorBottom: number;
  box: { top: number; bottom: number }; // the drawing's vertical extent on the plate
  maxScale: number; // never drawn bigger than this
  tip?: { x: number; y: number }; // dripper: where the particles leave the grounds
  labelX?: number[]; // cups: centre x of each cup on the plate, left to right
}

export type VesselKind = "server" | "dripper" | "cups";
export const VESSELS: Record<VesselKind, Vessel> = RAW;
export const vesselFor: (type: string) => VesselKind = rawVesselFor;
