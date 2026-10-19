import { z } from "zod";
import { haversine } from "./geo";
import { CATEGORIES, FILTERS, MAX_PEOPLE, MIN_PEOPLE, MODES } from "./types";

export const latLonSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const searchRequestSchema = z.object({
  people: z
    .array(z.object({ label: z.string().max(80), mode: z.enum(MODES), point: latLonSchema }))
    .min(MIN_PEOPLE)
    .max(MAX_PEOPLE),
  departAt: z.iso.datetime({ offset: true }),
  localTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  categories: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length),
  text: z.string().max(60),
  filters: z.array(z.enum(FILTERS)).max(FILTERS.length),
});

export function maxSpreadKm(points: { lat: number; lon: number }[]): number {
  let max = 0;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) max = Math.max(max, haversine(points[i], points[j]) / 1000);
  return max;
}
