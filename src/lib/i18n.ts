// Centralisation de libellés/synonymes utilisés pour les sélections

export const NO_BRAND_SYNONYMS: readonly string[] = [
  'sans marque',
  'no brand',
  'ohne marke',
  'sin marca',
  'senza marca',
  'zonder merk',
  'bez marki',
  'sem marca',
  'bez značky',
  'be prekės ženklo',
];

// Conditions d'état (en -> normalisé) + synonymes multi-langues
export const CONDITION_SYNONYMS: Record<string, string> = {
  // anglais de base
  new: 'New with tags',
  'new with tags': 'New with tags',
  'new without tags': 'New without tags',
  'very good': 'Very good',
  good: 'Good',
  satisfactory: 'Satisfactory',
  // français
  'neuf avec étiquette': 'New with tags',
  'neuf sans étiquette': 'New without tags',
  'très bon état': 'Very good',
  'tres bon etat': 'Very good',
  'bon état': 'Good',
  'bon etat': 'Good',
  satisfaisant: 'Satisfactory',
  // espagnol
  'nuevo con etiquetas': 'New with tags',
  'nuevo sin etiquetas': 'New without tags',
  'muy bueno': 'Very good',
  bueno: 'Good',
  satisfactorio: 'Satisfactory',
  // italien
  'nuovo con etichette': 'New with tags',
  'nuovo senza etichette': 'New without tags',
  'molto buono': 'Very good',
  buono: 'Good',
  soddisfacente: 'Satisfactory',
  // allemand
  'neu mit etikett': 'New with tags',
  'neu ohne etikett': 'New without tags',
  'sehr gut': 'Very good',
  gut: 'Good',
  zufriedenstellend: 'Satisfactory',
};

export function normalizeCondition(label: string): string {
  const l = (label || '').trim().toLowerCase();
  return CONDITION_SYNONYMS[l] || label;
}

// Matériaux: quelques synonymes basiques (les multipick utilisent déjà le titre exact)
export const MATERIAL_SYNONYMS: Record<string, string> = {
  cotton: 'Cotton',
  coton: 'Cotton',
  algodon: 'Cotton',
  cotone: 'Cotton',
  baumwolle: 'Cotton',
  leather: 'Leather',
  cuir: 'Leather',
  cuero: 'Leather',
  pelle: 'Leather',
  leder: 'Leather',
};

export function normalizeMaterial(label: string): string {
  const l = (label || '').trim().toLowerCase();
  return MATERIAL_SYNONYMS[l] || label;
}
