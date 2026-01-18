import React from 'react';
import styles from './Scrollbar.module.scss';

export type ScrollbarAxis = 'y' | 'x' | 'both';
export type ScrollbarTone = 'match' | 'contrast';

export interface ScrollbarProps extends React.HTMLAttributes<HTMLDivElement> {
  axis?: ScrollbarAxis;
  tone?: ScrollbarTone;
}

const joinClassName = (...parts: Array<string | undefined | false>) =>
  parts.filter(Boolean).join(' ');

export const Scrollbar = React.forwardRef<HTMLDivElement, ScrollbarProps>(
  ({ axis = 'y', tone = 'match', className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        data-axis={axis}
        data-tone={tone}
        className={joinClassName(styles.container, className)}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

Scrollbar.displayName = 'Scrollbar';

