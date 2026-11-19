"use client"
import "./cool-btn.css";

type CoolBtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export default function CoolBtn({ label = "Generate", ...props }: CoolBtnProps) {
  return (
    <div className="cool-btn">
      <div className="button-wrap">
        <button {...props}>
          <span>{label}</span>
        </button>
        <div className="button-shadow" />
      </div>

      <svg xmlns="http://www.w3.org/2000/svg" className="cool-btn-grid" aria-hidden="true">
        <defs>
          <pattern patternUnits="userSpaceOnUse" height={30} width={30} id="dottedGrid">
            <circle fill="rgba(0,0,0,0.15)" r={1} cy={2} cx={2} />
          </pattern>
        </defs>
        <rect fill="url(#dottedGrid)" height="100%" width="100%" />
      </svg>
    </div>
  );
}
