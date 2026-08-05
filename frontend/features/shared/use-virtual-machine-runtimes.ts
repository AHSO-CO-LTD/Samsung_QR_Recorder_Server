"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createVirtualMachineRuntime, type VirtualMachineRuntime } from "@/features/shared/virtual-machine-runtime";

export function useVirtualMachineRuntimes(accountId?: number | null) {
  const [items, setItems] = useState<VirtualMachineRuntime[]>([]);
  const sequence = useRef(0);

  useEffect(() => {
    sequence.current = 0;
    setItems([]);
  }, [accountId]);

  const createVirtualMachine = useCallback(() => {
    sequence.current += 1;
    const nextItem = createVirtualMachineRuntime(sequence.current);
    setItems((currentItems) => [...currentItems, nextItem]);
    return nextItem;
  }, []);

  return {
    virtualMachines: items,
    createVirtualMachine
  };
}
