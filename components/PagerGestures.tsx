import React, { createContext, useCallback, useContext, useEffect, useId, useState } from 'react';
import { ScrollView, ScrollViewProps, View } from 'react-native';
const LockContext = createContext<(id: string, locked: boolean) => void>(() => undefined);
export function PagerGestureProvider({
  children,
}: {
  children: (locked: boolean) => React.ReactNode;
}) {
  const [locks, setLocks] = useState<ReadonlySet<string>>(new Set());
  const setLock = useCallback(
    (id: string, locked: boolean) =>
      setLocks((old) => {
        if (old.has(id) === locked) return old;
        const next = new Set(old);
        if (locked) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );
  return <LockContext.Provider value={setLock}>{children(locks.size > 0)}</LockContext.Provider>;
}
// Child horizontal scrollers own their gesture; vertical lists remain native scroll views.
export function usePagerLock() {
  const setLock = useContext(LockContext);
  const id = useId();
  useEffect(() => () => setLock(id, false), [id, setLock]);
  return { lock: () => setLock(id, true), unlock: () => setLock(id, false) };
}
export function HorizontalScroll({ children, ...props }: ScrollViewProps) {
  const { lock, unlock } = usePagerLock();
  return (
    <View
      onTouchStart={lock}
      onTouchEnd={unlock}
      onTouchCancel={unlock}
      onPointerDown={lock}
      onPointerUp={unlock}
      onPointerCancel={unlock}
      onPointerLeave={unlock}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...props}
      >
        {children}
      </ScrollView>
    </View>
  );
}
