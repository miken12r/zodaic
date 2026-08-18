export type ZodaicSignSlug =
  | 'catalyst'
  | 'archive'
  | 'stream'
  | 'sanctuary'
  | 'spotlight'
  | 'analyst'
  | 'forum'
  | 'depths'
  | 'explorer'
  | 'enterprise'
  | 'network'
  | 'dream'

export interface ZodaicSign {
  id: number
  name: string
  slug: ZodaicSignSlug
  traditional_analog: string
  tagline: string
  description: string
  characteristics: string[]
  element: 'fire' | 'earth' | 'air' | 'water'
  symbol: string
  color: string
}

export interface Profile {
  id: string
  username: string
  display_name: string | null
  birth_date: string | null
  traditional_sign: string | null
  primary_zodaic_sign_id: number | null
  created_at: string
}

export interface ContentItem {
  id: string
  url: string
  title: string
  description: string | null
  zodaic_sign_id: number
  classification_confidence: number
  characteristics: string[]
  classified_at: string
  zodaic_sign?: ZodaicSign
}

export interface Horoscope {
  id: string
  zodaic_sign_id: number
  period: 'weekly' | 'monthly'
  period_start: string
  period_end: string
  content: string
  themes: string[]
  generated_at: string
  zodaic_sign?: ZodaicSign
}

export interface UserSignAffinity {
  id: string
  user_id: string
  zodaic_sign_id: number
  affinity_score: number
  calculated_at: string
  zodaic_sign?: ZodaicSign
}

export interface Share {
  id: string
  user_id: string
  content_type: 'horoscope' | 'content_affinity' | 'sign_reading'
  content_id: string
  message: string | null
  created_at: string
  profile?: Profile
}
