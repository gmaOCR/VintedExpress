import { z } from 'zod';

export interface RepublishDraft {
  title: string;
  description: string;
  images: string[];
  priceValue?: number; // prix numérique (euros, séparateur point), ex: 22.5
  currency?: string; // ex: EUR, €, etc. (meilleur-effort)
  condition?: string; // libellé tel qu’affiché, ex: "Neuf sans étiquette"
  material?: string; // ex: "Acier"
  color?: string[]; // ex: ["Gris", "Argenté"]
  categoryPath?: string[]; // ex: ["Hommes", "Accessoires", "Bijoux", "Colliers"]
}

export const RepublishDraftSchema = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  images: z.array(z.string()).default([]),
  priceValue: z.number().optional(),
  currency: z.string().optional(),
  condition: z.string().optional(),
  material: z.string().optional(),
  color: z.array(z.string()).optional(),
  categoryPath: z.array(z.string()).optional(),
});

export type RepublishDraftParsed = z.infer<typeof RepublishDraftSchema>;

export const KEY_REPUBLISH_DRAFT = 'vx:republishDraft';
