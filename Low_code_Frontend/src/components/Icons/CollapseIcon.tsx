import React from 'react';

interface CollapseIconProps {
  expanded?: boolean;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 圆滑折线折叠图标组件
 */
const CollapseIcon: React.FC<CollapseIconProps> = ({
  expanded = false,
  size = 16,
  color = 'currentColor',
  className = '',
  style = {},
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        ...style,
      }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 10L12 14L16 10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default CollapseIcon;

