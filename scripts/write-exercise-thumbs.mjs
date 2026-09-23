import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "public", "exercise-thumbs");
fs.mkdirSync(dir, { recursive: true });

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-hidden="true">
  <rect width="256" height="256" rx="28" fill="#10141b"/>
  <rect x="10" y="10" width="8" height="236" rx="4" fill="#D0FF00"/>
  ${inner}
</svg>
`;
}

const thumbs = {
  "goblet-squat": `
  <circle cx="128" cy="58" r="18" fill="#f5f5f5"/>
  <path d="M104 86 L152 86 L160 150 L148 210 L108 210 L96 150 Z" fill="#f5f5f5"/>
  <rect x="116" y="92" width="24" height="28" rx="6" fill="#D0FF00"/>
  <path d="M96 150 L64 176 M160 150 L192 176" stroke="#9aa3b2" stroke-width="10" stroke-linecap="round"/>`,
  "romanian-deadlift": `
  <circle cx="118" cy="70" r="16" fill="#f5f5f5"/>
  <path d="M92 88 L132 96 L168 148 L140 168 L88 132 Z" fill="#f5f5f5"/>
  <path d="M88 132 L78 200 M140 168 L168 208" stroke="#f5f5f5" stroke-width="14" stroke-linecap="round"/>
  <rect x="58" y="196" width="130" height="12" rx="6" fill="#D0FF00"/>`,
  "reverse-lunge": `
  <circle cx="132" cy="52" r="16" fill="#f5f5f5"/>
  <path d="M116 72 L152 78 L154 140 L118 136 Z" fill="#f5f5f5"/>
  <path d="M118 136 L86 200 M154 140 L190 168" stroke="#f5f5f5" stroke-width="12" stroke-linecap="round"/>
  <circle cx="82" cy="206" r="8" fill="#D0FF00"/><circle cx="194" cy="174" r="8" fill="#D0FF00"/>`,
  "squat-jump-or-box-step-up": `
  <rect x="150" y="150" width="70" height="56" rx="6" fill="#2a313c"/>
  <circle cx="110" cy="70" r="16" fill="#f5f5f5"/>
  <path d="M94 88 L128 92 L136 150 L88 146 Z" fill="#f5f5f5"/>
  <path d="M88 146 L70 190 M136 150 L168 150" stroke="#f5f5f5" stroke-width="12" stroke-linecap="round"/>
  <path d="M168 150 L188 128" stroke="#D0FF00" stroke-width="8" stroke-linecap="round"/>`,
  "front-plank": `
  <circle cx="54" cy="118" r="14" fill="#f5f5f5"/>
  <path d="M68 118 L200 118 L206 138 L62 138 Z" fill="#f5f5f5"/>
  <path d="M200 138 L220 168 M68 138 L52 168" stroke="#f5f5f5" stroke-width="10" stroke-linecap="round"/>
  <line x1="40" y1="176" x2="230" y2="176" stroke="#D0FF00" stroke-width="6"/>`,
  "push-up-or-dumbbell-bench-press": `
  <rect x="48" y="150" width="160" height="18" rx="6" fill="#2a313c"/>
  <circle cx="78" cy="92" r="14" fill="#f5f5f5"/>
  <path d="M90 98 L186 110 L180 132 L84 120 Z" fill="#f5f5f5"/>
  <circle cx="70" cy="148" r="10" fill="#D0FF00"/><circle cx="196" cy="148" r="10" fill="#D0FF00"/>`,
  "one-arm-row": `
  <rect x="40" y="150" width="90" height="16" rx="6" fill="#2a313c"/>
  <circle cx="150" cy="70" r="14" fill="#f5f5f5"/>
  <path d="M120 88 L168 96 L150 150 L96 140 Z" fill="#f5f5f5"/>
  <path d="M168 96 L200 70" stroke="#f5f5f5" stroke-width="10" stroke-linecap="round"/>
  <circle cx="208" cy="62" r="10" fill="#D0FF00"/>`,
  "overhead-press": `
  <circle cx="128" cy="86" r="16" fill="#f5f5f5"/>
  <path d="M108 104 L148 104 L154 176 L102 176 Z" fill="#f5f5f5"/>
  <path d="M102 176 L88 220 M154 176 L168 220" stroke="#f5f5f5" stroke-width="12" stroke-linecap="round"/>
  <rect x="72" y="48" width="112" height="10" rx="5" fill="#D0FF00"/>`,
  "band-pull-apart-or-face-pull": `
  <circle cx="128" cy="64" r="16" fill="#f5f5f5"/>
  <path d="M110 84 L146 84 L150 160 L106 160 Z" fill="#f5f5f5"/>
  <path d="M110 100 L58 92 M146 100 L198 92" stroke="#f5f5f5" stroke-width="10" stroke-linecap="round"/>
  <path d="M58 92 C128 40 128 40 198 92" fill="none" stroke="#D0FF00" stroke-width="6"/>`,
  "farmer-carry": `
  <circle cx="128" cy="56" r="16" fill="#f5f5f5"/>
  <path d="M110 76 L146 76 L152 160 L104 160 Z" fill="#f5f5f5"/>
  <path d="M104 160 L96 220 M152 160 L160 220" stroke="#f5f5f5" stroke-width="12" stroke-linecap="round"/>
  <rect x="62" y="150" width="22" height="36" rx="6" fill="#D0FF00"/>
  <rect x="172" y="150" width="22" height="36" rx="6" fill="#D0FF00"/>`,
  "kettlebell-swing-or-hip-hinge": `
  <circle cx="108" cy="64" r="16" fill="#f5f5f5"/>
  <path d="M88 84 L128 94 L150 150 L96 148 Z" fill="#f5f5f5"/>
  <path d="M96 148 L80 210 M150 150 L176 200" stroke="#f5f5f5" stroke-width="12" stroke-linecap="round"/>
  <circle cx="196" cy="150" r="16" fill="#D0FF00"/>`,
  "chin-up-band-assist-or-lat-pulldown": `
  <rect x="48" y="36" width="160" height="10" rx="5" fill="#D0FF00"/>
  <circle cx="128" cy="92" r="16" fill="#f5f5f5"/>
  <path d="M88 46 L108 92 L148 92 L168 46" stroke="#f5f5f5" stroke-width="10" stroke-linecap="round"/>
  <path d="M110 108 L146 108 L150 176 L106 176 Z" fill="#f5f5f5"/>`,
  "lateral-bound-or-side-step-over": `
  <circle cx="96" cy="70" r="16" fill="#f5f5f5"/>
  <path d="M80 88 L116 92 L124 150 L76 148 Z" fill="#f5f5f5"/>
  <path d="M76 148 L58 200 M124 150 L168 132" stroke="#f5f5f5" stroke-width="12" stroke-linecap="round"/>
  <path d="M168 132 L210 110" stroke="#D0FF00" stroke-width="8" stroke-linecap="round"/>`,
  "jump-rope-or-easy-bike-intervals": `
  <circle cx="128" cy="62" r="16" fill="#f5f5f5"/>
  <path d="M110 82 L146 82 L150 150 L106 150 Z" fill="#f5f5f5"/>
  <path d="M106 150 L92 210 M150 150 L164 210" stroke="#f5f5f5" stroke-width="12" stroke-linecap="round"/>
  <path d="M70 210 C128 40 128 40 186 210" fill="none" stroke="#D0FF00" stroke-width="6"/>`,
  "side-plank": `
  <circle cx="68" cy="86" r="14" fill="#f5f5f5"/>
  <path d="M80 92 L200 150 L190 170 L70 112 Z" fill="#f5f5f5"/>
  <path d="M200 170 L216 196 M70 112 L52 150" stroke="#f5f5f5" stroke-width="10" stroke-linecap="round"/>
  <line x1="40" y1="204" x2="230" y2="204" stroke="#D0FF00" stroke-width="6"/>`,
  fallback: `
  <circle cx="128" cy="78" r="18" fill="#f5f5f5"/>
  <path d="M104 100 L152 100 L158 176 L98 176 Z" fill="#f5f5f5"/>
  <path d="M98 176 L84 222 M158 176 L172 222" stroke="#f5f5f5" stroke-width="12" stroke-linecap="round"/>
  <circle cx="128" cy="132" r="8" fill="#D0FF00"/>`,
};

for (const [name, inner] of Object.entries(thumbs)) {
  fs.writeFileSync(path.join(dir, `${name}.svg`), svg(inner));
}
console.log(`Wrote ${Object.keys(thumbs).length} thumbs to ${dir}`);
