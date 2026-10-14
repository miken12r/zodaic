// Lets the setup screen tell the root layout the profile is now complete, so the
// layout's "incomplete profile → /setup" redirect doesn't bounce the user back
// before it re-checks the database.
type Listener = () => void
const listeners = new Set<Listener>()

export function onProfileCompleted(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function notifyProfileCompleted(): void {
  for (const l of listeners) l()
}
