export interface ToastMessage {
  id: string;
  text: string;
}

type Listener = (toasts: ToastMessage[]) => void;

let toasts: ToastMessage[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

/** Shows a transient toast notification. Fire-and-forget; auto-dismisses after ~3s. */
export function showToast(text: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  toasts = [...toasts, { id, text }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((toast) => toast.id !== id);
    emit();
  }, 3000);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}
