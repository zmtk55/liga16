import type { SVGAttributes } from "react";

const Logo = (props: SVGAttributes<SVGElement>) => {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width="147"
        height="40"
        viewBox="0 0 147 40"
        fill="#1e293b"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <rect x="0" y="0" width="147" height="40" rx="8" ry="8" fill="#0f172a" />
        <path
          d="M15 15h20 M25 25h40 M35 35h25"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="75" cy="20" r="8" fill="#3b82f6" />
        <text
          x="75%"
          y="50%"
          dominant-baseline="middle"
          text-anchor="middle"
          fill="white"
          fontFamily="Inter, system-ui, -apple-font, sans-serif"
          fontSize="11"
          fontWeight="600"
        >
          PR
        </text>
      </svg>
    </div>
  );
};

export default Logo;