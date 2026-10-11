import { ZodaicSign } from '@/types'

export const ZODAIC_SIGNS: ZodaicSign[] = [
  {
    id: 1,
    name: 'The Catalyst',
    slug: 'catalyst',
    traditional_analog: 'Aries',
    traditional_glyph: '♈',
    traditional_reason:
      "Aries opens the zodiac — the initiator that charges in first, like news that breaks before anyone's ready.",
    tagline: 'First. Loudest. Always moving.',
    description:
      'Pioneering content that ignites movements — breaking news, startups, viral trends, and disruptive ideas that arrive before the world is ready.',
    characteristics: ['breaking news', 'startups', 'viral trends', 'product launches', 'manifestos'],
    element: 'fire',
    symbol: '⚡',
    color: '#FF4136',
  },
  {
    id: 2,
    name: 'The Archive',
    slug: 'archive',
    traditional_analog: 'Taurus',
    traditional_glyph: '♉',
    traditional_reason:
      'Taurus is steady and slow to change, valuing what endures — like a reference you can trust for decades.',
    tagline: 'Built to last. Worth trusting.',
    description:
      'Enduring, authoritative content — encyclopedias, reference sites, established institutions, and repositories whose value only grows with time.',
    characteristics: ['encyclopedias', 'documentation', 'reference', 'libraries', 'historical records'],
    element: 'earth',
    symbol: '📚',
    color: '#C8A165',
  },
  {
    id: 3,
    name: 'The Stream',
    slug: 'stream',
    traditional_analog: 'Gemini',
    traditional_glyph: '♊',
    traditional_reason:
      'Gemini, the twins, is ruled by Mercury the messenger — endless talk, quick replies, two sides of every thread.',
    tagline: 'Always talking. Always changing.',
    description:
      'Fast-moving, conversational content — social feeds, messaging platforms, commentary, and threads that exist in the moment and evolve by the hour.',
    characteristics: ['social media', 'messaging', 'forums', 'commentary', 'live updates'],
    element: 'air',
    symbol: '💬',
    color: '#7FDBFF',
  },
  {
    id: 4,
    name: 'The Sanctuary',
    slug: 'sanctuary',
    traditional_analog: 'Cancer',
    traditional_glyph: '♋',
    traditional_reason:
      'Cancer is ruled by the Moon and governs home and care — the corners of the internet where people feel looked after.',
    tagline: 'Where people come to heal and belong.',
    description:
      'Nurturing, community-driven content — support groups, wellness platforms, parenting communities, and spaces built around care and shared vulnerability.',
    characteristics: ['wellness', 'community support', 'mental health', 'parenting', 'forums'],
    element: 'water',
    symbol: '🌙',
    color: '#B10DC9',
  },
  {
    id: 5,
    name: 'The Spotlight',
    slug: 'spotlight',
    traditional_analog: 'Leo',
    traditional_glyph: '♌',
    traditional_reason:
      'Leo is ruled by the Sun and loves center stage — content made to be watched and applauded.',
    tagline: 'See me. Watch me. Love me.',
    description:
      'Entertainment, celebrity, and creative expression — platforms built for performance, fandom, and the kind of content that demands an audience.',
    characteristics: ['entertainment', 'celebrity', 'streaming', 'fan culture', 'creative portfolios'],
    element: 'fire',
    symbol: '⭐',
    color: '#FF851B',
  },
  {
    id: 6,
    name: 'The Analyst',
    slug: 'analyst',
    traditional_analog: 'Virgo',
    traditional_glyph: '♍',
    traditional_reason:
      'Virgo is the detail-minded perfectionist — content that measures, checks, and corrects.',
    tagline: 'Precise. Detailed. Always right.',
    description:
      'Data-driven, methodical content — research papers, analytics tools, technical documentation, and platforms that value accuracy above all else.',
    characteristics: ['data', 'research', 'analytics', 'technical docs', 'fact-checking'],
    element: 'earth',
    symbol: '🔬',
    color: '#01FF70',
  },
  {
    id: 7,
    name: 'The Forum',
    slug: 'forum',
    traditional_analog: 'Libra',
    traditional_glyph: '♎',
    traditional_reason:
      "Libra's symbol is the scales — weighing every side, like debates, reviews, and op-eds.",
    tagline: 'Every side. Every voice. You decide.',
    description:
      'Balanced debate and marketplace-of-ideas content — op-eds, discussion boards, review platforms, and sites where competing perspectives coexist.',
    characteristics: ['debate', 'reviews', 'op-eds', 'marketplaces', 'polling'],
    element: 'air',
    symbol: '⚖️',
    color: '#F012BE',
  },
  {
    id: 8,
    name: 'The Depths',
    slug: 'depths',
    traditional_analog: 'Scorpio',
    traditional_glyph: '♏',
    traditional_reason:
      "Scorpio rules what's hidden and taboo — content that digs beneath the surface story.",
    tagline: 'Dig deeper. The surface lies.',
    description:
      'Investigative, layered content — long-form journalism, whistleblower platforms, security research, and anything that rewards those willing to look further.',
    characteristics: ['investigative journalism', 'security research', 'whistleblowing', 'deep dives', 'archives'],
    element: 'water',
    symbol: '🔦',
    color: '#85144b',
  },
  {
    id: 9,
    name: 'The Explorer',
    slug: 'explorer',
    traditional_analog: 'Sagittarius',
    traditional_glyph: '♐',
    traditional_reason:
      'Sagittarius, the archer, aims far — the traveler and philosopher who learns by going further.',
    tagline: 'Knowledge is the only destination.',
    description:
      'Expansive, curiosity-driven content — online courses, travel platforms, philosophy, and anything that expands your world beyond the familiar.',
    characteristics: ['education', 'travel', 'philosophy', 'online courses', 'cultural discovery'],
    element: 'fire',
    symbol: '🧭',
    color: '#FFDC00',
  },
  {
    id: 10,
    name: 'The Enterprise',
    slug: 'enterprise',
    traditional_analog: 'Capricorn',
    traditional_glyph: '♑',
    traditional_reason:
      'Capricorn, the mountain goat, climbs steadily toward status and results — the language of business and ROI.',
    tagline: 'Results over everything.',
    description:
      'Professional, business-oriented content — finance platforms, B2B tools, productivity suites, and professional networks where ROI is the language.',
    characteristics: ['business', 'finance', 'B2B tools', 'productivity', 'professional networks'],
    element: 'earth',
    symbol: '💼',
    color: '#AAAAAA',
  },
  {
    id: 11,
    name: 'The Network',
    slug: 'network',
    traditional_analog: 'Aquarius',
    traditional_glyph: '♒',
    traditional_reason:
      'Aquarius is the visionary of groups and causes — open, collective, built by the many.',
    tagline: 'Open. Connected. Ahead of its time.',
    description:
      'Innovation and collective intelligence content — open source, tech communities, decentralized platforms, and anything built by the many for the many.',
    characteristics: ['open source', 'tech communities', 'decentralized', 'innovation', 'collective projects'],
    element: 'air',
    symbol: '🕸️',
    color: '#0074D9',
  },
  {
    id: 12,
    name: 'The Dream',
    slug: 'dream',
    traditional_analog: 'Pisces',
    traditional_glyph: '♓',
    traditional_reason:
      'Pisces, two fish in the deep, is ruled by Neptune, planet of dreams — art and spirit that dissolve boundaries.',
    tagline: 'Where imagination lives.',
    description:
      'Art, music, film, and spiritual content — platforms that dissolve the boundary between creator and dreamer, and exist to move you.',
    characteristics: ['art', 'music', 'film', 'spirituality', 'creative fiction', 'poetry'],
    element: 'water',
    symbol: '🌌',
    color: '#A78BFA',
  },
]

export const SIGN_BY_SLUG = Object.fromEntries(
  ZODAIC_SIGNS.map((s) => [s.slug, s])
) as Record<string, ZodaicSign>

export const SIGN_BY_ID = Object.fromEntries(
  ZODAIC_SIGNS.map((s) => [s.id, s])
) as Record<number, ZodaicSign>

export function dropThe(name: string): string {
  return name.replace(/^The /, '')
}
