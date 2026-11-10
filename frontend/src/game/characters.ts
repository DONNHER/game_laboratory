export interface CharacterMeta {
  id: string;
  name: string;
  gender: 'BOY' | 'GIRL';
  title: string;
  subtitle: string;
  description: string;
  lore: string;
  accentColor: string;
  secondaryColor: string;
  glowColor: string;
  textColorClass: string;
  dotColorClass: string;
  speedRating: number;
  agilityRating: number;
  armorRating: number;
  tags: string[];
}

export const PREMADE_CHARACTERS: CharacterMeta[] = [
  {
    id: 'kai',
    name: 'Kai',
    gender: 'BOY',
    title: 'Cyber Striker',
    subtitle: 'Balanced Sprinter',
    description:
      'High-agility sprinter equipped with twin micro-thrusters and an aerodynamic combat visor.',
    lore: 'Trained on midnight sprint circuits, Kai pairs rapid lane shifts with relentless top-end stamina.',
    accentColor: '#06b6d4',
    secondaryColor: '#0284c7',
    glowColor: '#38bdf8',
    textColorClass: 'text-cyan-400',
    dotColorClass: 'bg-cyan-400',
    speedRating: 92,
    agilityRating: 90,
    armorRating: 78,
    tags: ['Acrobatic', 'Ion Thrusters', 'All-Rounder'],
  },
  {
    id: 'blaze',
    name: 'Blaze',
    gender: 'BOY',
    title: 'Heavy Vanguard',
    subtitle: 'Armored Powerhouse',
    description:
      'Reinforced exosuit runner with heavy shoulder plates, blast visor, and quad rocket boosters.',
    lore: 'Built for high-impact districts, Blaze powers through tight corridors with unmatched stability.',
    accentColor: '#ef4444',
    secondaryColor: '#b91c1c',
    glowColor: '#f97316',
    textColorClass: 'text-red-400',
    dotColorClass: 'bg-red-500',
    speedRating: 84,
    agilityRating: 80,
    armorRating: 98,
    tags: ['Heavy Armor', 'Quad Boosters', 'High Stability'],
  },
  {
    id: 'nova',
    name: 'Nova',
    gender: 'GIRL',
    title: 'Neon Valkyrie',
    subtitle: 'Supersonic Acrobat',
    description:
      'Featherweight speedster suit featuring twin energy ribbons and swept-back aero wings.',
    lore: 'Renowned for effortless aerial clearance and razor-sharp reflexes at top speed.',
    accentColor: '#ec4899',
    secondaryColor: '#db2777',
    glowColor: '#f472b6',
    textColorClass: 'text-pink-400',
    dotColorClass: 'bg-pink-500',
    speedRating: 96,
    agilityRating: 96,
    armorRating: 72,
    tags: ['Aero Wings', 'Featherweight', 'Top Speed'],
  },
  {
    id: 'luna',
    name: 'Luna',
    gender: 'GIRL',
    title: 'Shadow Runner',
    subtitle: 'Precision Sprinter',
    description:
      'Sleek stealth runner with an obsidian cowl, panoramic night visor, and silent emerald boosters.',
    lore: 'Specializes in threading narrow gaps and slipping past laser gates without losing stride.',
    accentColor: '#10b981',
    secondaryColor: '#059669',
    glowColor: '#34d399',
    textColorClass: 'text-emerald-400',
    dotColorClass: 'bg-emerald-500',
    speedRating: 94,
    agilityRating: 95,
    armorRating: 82,
    tags: ['Night Visor', 'Silent Boost', 'Precision'],
  },
  {
    id: 'zephyr',
    name: 'Zephyr',
    gender: 'BOY',
    title: 'Phantom Blade',
    subtitle: 'Cyber Ronin (.tscn)',
    description:
      'Custom Godot 4.7 scene runner armed with twin plasma katanas, gold kabuto horns, and holo-wings.',
    lore: 'Authored directly as a dedicated Godot 3D scene (res://scenes/characters/zephyr.tscn) with custom meshes and materials.',
    accentColor: '#8b5cf6',
    secondaryColor: '#6d28d9',
    glowColor: '#c084fc',
    textColorClass: 'text-violet-400',
    dotColorClass: 'bg-violet-500',
    speedRating: 97,
    agilityRating: 94,
    armorRating: 86,
    tags: ['Twin Katanas', 'Kabuto Crest', 'Godot .tscn'],
  },
];

export function getCharacterMeta(characterId: string = 'kai'): CharacterMeta {
  const match = PREMADE_CHARACTERS.find(
    (c) => c.id.toLowerCase() === characterId.toLowerCase()
  );
  return match || PREMADE_CHARACTERS[0];
}
