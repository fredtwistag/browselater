"use client";

import * as React from "react";
import type { ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

const listeners: Array<(toasts: ToasterToast[]) => void> = [];
let memoryState: ToasterToast[] = [];

function emit() {
  for (const l of listeners) l(memoryState);
}

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

export function toast(props: Omit<ToasterToast, "id">) {
  const id = genId();
  memoryState = [{ ...props, id }, ...memoryState].slice(0, TOAST_LIMIT);
  emit();
  setTimeout(() => {
    memoryState = memoryState.filter((t) => t.id !== id);
    emit();
  }, TOAST_REMOVE_DELAY);
  return id;
}

export function useToast() {
  const [state, setState] = React.useState<ToasterToast[]>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return { toasts: state, toast };
}
