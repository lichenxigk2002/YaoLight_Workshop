import React from 'react';

interface StarBadgeIconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

const StarBadgeIcon: React.FC<StarBadgeIconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = '',
  style = {}
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 800 800" 
      fill="none"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0,800) scale(0.1,-0.1)">
        <path 
          d="M3920 6360 c-181 -28 -354 -152 -441 -314 -19 -33 -72 -144 -120 -246 -139 -297 -183 -367 -304 -485 -99 -97 -211 -166 -342 -211 -116 -39 -210 -57 -433 -79 -225 -22 -290 -37 -396 -89 -256 -127 -388 -426 -308 -698 43 -144 108 -228 352 -451 172 -157 248 -244 314 -359 84 -145 122 -293 121 -473 -1 -102 -8 -158 -52 -377 -71 -357 -69 -444 16 -618 68 -140 220 -262 383 -306 95 -25 227 -24 320 5 69 21 251 109 310 151 107 76 322 177 437 206 79 20 123 25 223 25 216 0 344 -44 645 -221 252 -148 345 -183 495 -183 99 -1 182 19 278 65 91 44 215 168 259 258 80 164 83 278 16 604 -45 222 -47 238 -47 401 0 156 2 177 27 258 57 186 132 301 304 467 60 58 161 155 225 217 128 123 181 199 220 318 32 99 32 250 0 355 -62 197 -216 344 -423 404 -30 9 -154 27 -277 41 -320 36 -408 57 -557 133 -88 44 -137 80 -211 152 -131 128 -173 196 -328 528 -106 227 -150 297 -238 376 -124 113 -310 171 -468 146z" 
          fill={color}
          stroke="none"
        />
      </g>
    </svg>
  );
};

export default StarBadgeIcon;

