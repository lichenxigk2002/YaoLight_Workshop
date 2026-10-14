import { Suspense, type ReactNode } from 'react';

export function lazyElement(children: ReactNode) {
  return <Suspense fallback={<div />}>{children}</Suspense>;
}
