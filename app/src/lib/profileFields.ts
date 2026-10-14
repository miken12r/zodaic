// Rules for the three required profile fields (username, display name, birth
// date), shared by the first-run setup screen and the Profile tab. Nothing is
// verified beyond format — the app doesn't check identity or real birth dates.

const isUS = Intl.DateTimeFormat().resolvedOptions().locale.startsWith('en-US')
export const DATE_FORMAT = isUS ? 'MM/DD/YYYY' : 'DD/MM/YYYY'

export function toDisplayDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return isUS ? `${m}/${d}/${y}` : `${d}/${m}/${y}`
}

export function toISODate(display: string): string {
  const parts = display.split('/')
  if (parts.length !== 3) return display
  const [a, b, y] = parts
  const [m, d] = isUS ? [a, b] : [b, a]
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function getZodaicSignId(birthDate: string): number | null {
  const date = new Date(birthDate)
  if (isNaN(date.getTime())) return null
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return 1
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return 2
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return 3
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return 4
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return 5
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return 6
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return 7
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return 8
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return 9
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return 10
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return 11
  return 12
}

export function validateUsername(value: string): string {
  if (!value.trim()) return 'Username is required.'
  if (/\s/.test(value)) return 'Username cannot contain spaces.'
  if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores allowed.'
  if (value.length < 3) return 'Username must be at least 3 characters.'
  if (value.length > 30) return 'Username must be 30 characters or fewer.'
  return ''
}

export function validateDisplayName(value: string): string {
  const v = value.trim()
  if (!v) return 'Display name is required.'
  if (v.length > 50) return 'Display name must be 50 characters or fewer.'
  return ''
}

// Format and plausibility only (a real calendar date, not in the future).
export function validateBirthDate(display: string): string {
  if (!display.trim()) return 'Birth date is required.'
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(display.trim())) return `Enter as ${DATE_FORMAT}.`
  const iso = toISODate(display.trim())
  const date = new Date(`${iso}T00:00:00Z`)
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return 'That date does not exist.'
  if (date.getTime() > Date.now()) return 'Birth date cannot be in the future.'
  if (date.getUTCFullYear() < 1900) return 'Please enter a year after 1900.'
  return ''
}

export function isProfileComplete(p: { username?: string | null; display_name?: string | null; birth_date?: string | null } | null): boolean {
  return !!(p?.username && p.display_name && p.birth_date)
}

// Turns a Supabase error from saving a profile into a user-facing message.
export function profileSaveErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === '23505') return 'That username is taken. Try another.'
  return error.message ?? 'Could not save your profile. Try again.'
}
