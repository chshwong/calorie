import { LB_PER_KG } from "@/lib/domain/weight-constants";

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function roundTo3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
