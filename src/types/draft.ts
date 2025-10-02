import { z } from 'zod';

export interface RepublishDraft {
  title: string;
  description: string;
  images: string[];
  priceValue?: number; // prix numérique (euros, séparateur point), ex: 22.5
  currency?: string; // ex: EUR, €, etc. (meilleur-effort)
  condition?: string; // libellé tel qu’affiché, ex: "Neuf sans étiquette"
  size?: string; // ex: "M", "38", "One size"
  material?: string; // ex: "Acier"
  color?: string[]; // ex: ["Gris", "Argenté"]
  categoryPath?: string[]; // ex: ["Hommes", "Accessoires", "Bijoux", "Colliers"]
  unisex?: boolean; // vrai si l'annonce d'origine indique Unisexe/Unisex

  // Champs additionnels issus du modèle Vinted
  brand?: string; // ex: "Nike"
  brandId?: number;
  status?: string; // ex: "Disponible", "Vendu"
  statusId?: number;
  patterns?: string[]; // ex: ["Fleuri", "Rayé"]
  patternsId?: number[];
  country?: string; // ex: "FR"
  countryId?: string;
  createdAt?: string;
  updatedAt?: string;
  promoted?: boolean;
  url?: string;
  favoriteCount?: number;
  viewCount?: number;
  priceOriginal?: number;
  isReserved?: boolean;
  isSold?: boolean;
  deliveryType?: string;
  userId?: number;
  userLogin?: string;
}

export const RepublishDraftSchema = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  images: z.array(z.string()).default([]),
  priceValue: z.number().optional(),
  currency: z.string().optional(),
  condition: z.string().optional(),
  size: z.string().optional(),
  material: z.string().optional(),
  color: z.array(z.string()).optional(),
  categoryPath: z.array(z.string()).optional(),
  unisex: z.boolean().optional(),

  // Champs additionnels
  brand: z.string().optional(),
  brandId: z.number().optional(),
  status: z.string().optional(),
  statusId: z.number().optional(),
  patterns: z.array(z.string()).optional(),
  patternsId: z.array(z.number()).optional(),
  country: z.string().optional(),
  countryId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  promoted: z.boolean().optional(),
  url: z.string().optional(),
  favoriteCount: z.number().optional(),
  viewCount: z.number().optional(),
  priceOriginal: z.number().optional(),
  isReserved: z.boolean().optional(),
  isSold: z.boolean().optional(),
  deliveryType: z.string().optional(),
  userId: z.number().optional(),
  userLogin: z.string().optional(),
});

export type RepublishDraftParsed = z.infer<typeof RepublishDraftSchema>;

export const KEY_REPUBLISH_DRAFT = 'vx:republishDraft';
export const KEY_REPUBLISH_SOURCE = 'vx:republishSource';
