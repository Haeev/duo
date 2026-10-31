/** Désabonne un écouteur. */
export type Unsubscribe = () => void;

type Listener<T> = (payload: T) => void;

/**
 * Émetteur typé et synchrone. Une exception d'un écouteur ne casse ni les autres
 * écouteurs ni l'émetteur: elle est remise à `onListenerError`.
 */
export class Emitter<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();
  private readonly onListenerError: (error: unknown) => void;

  constructor(onListenerError: (error: unknown) => void = () => undefined) {
    this.onListenerError = onListenerError;
  }

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    let set = this.listeners.get(event);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (set === undefined) return;
    for (const listener of [...set]) {
      try {
        (listener as Listener<Events[K]>)(payload);
      } catch (error) {
        this.onListenerError(error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
