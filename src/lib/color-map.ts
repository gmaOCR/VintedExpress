import { normalize } from './dom-utils';

export function colorSynonym(label: string): string {
  const l = normalize(label);
  if (l === 'gray') return 'grey';
  if (l === 'transparent') return 'clear';
  return label;
}

export function colorToSlug(label: string): string | null {
  const l = normalize(label);
  const map: Record<string, string> = {
    black: 'black',
    brown: 'brown',
    grey: 'grey',
    gray: 'grey',
    beige: 'body',
    body: 'body',
    pink: 'pink',
    purple: 'purple',
    red: 'red',
    yellow: 'yellow',
    blue: 'blue',
    'light blue': 'light-blue',
    navy: 'navy',
    green: 'green',
    'dark green': 'dark-green',
    orange: 'orange',
    white: 'white',
    silver: 'silver',
    gold: 'gold',
    multi: 'various',
    various: 'various',
    khaki: 'khaki',
    turquoise: 'turquoise',
    cream: 'cream',
    apricot: 'apricot',
    coral: 'coral',
    burgundy: 'burgundy',
    rose: 'rose',
    lilac: 'lilac',
    mint: 'mint',
    mustard: 'mustard',
    clear: 'clear',
    transparent: 'clear',
  };
  return map[l] ?? null;
}
