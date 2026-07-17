export const SKINTONES = [
  { id: "light", value: "#FFDBB5", label: "Light" },
  { id: "medium_light", value: "#F1C27D", label: "Medium Light" },
  { id: "medium", value: "#E0A96D", label: "Medium" },
  { id: "tan", value: "#C68642", label: "Tan" },
  { id: "dark", value: "#8D5524", label: "Dark" },
];

export const HAIR_COLORS = [
  { id: "black", value: "#1A1A1A", label: "Black" },
  { id: "brown", value: "#4A3018", label: "Brown" },
  { id: "blonde", value: "#E8C078", label: "Blonde" },
  { id: "blue", value: "#2A4B7C", label: "Blue" },
  { id: "orange", value: "#D95C14", label: "Orange" },
  { id: "white", value: "#EEEEEE", label: "White" },
];

export const OUTFIT_COLORS = [
  { id: "black", value: "#1A1A1A", label: "Black" },
  { id: "orange", value: "#0B132B", label: "Orange" },
  { id: "white", value: "#F8F9FD", label: "White" },
  { id: "blue", value: "#02006c", label: "Dark Blue" },
  { id: "green", value: "#10B981", label: "Emerald" },
];

export const BACKGROUNDS = [
  { id: "gradient_orange", value: "linear-gradient(135deg, #0B132B 0%, #1A2542 100%)", label: "Orange Glow" },
  { id: "gradient_blue", value: "linear-gradient(135deg, #02006c 0%, #0a08a0 100%)", label: "Deep Blue" },
  { id: "neon_purple", value: "linear-gradient(135deg, #8B5CF6 0%, #C084FC 100%)", label: "Neon Purple" },
  { id: "gaming_dark", value: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", label: "Dark Mode" },
  { id: "clean_white", value: "#F8F9FD", label: "Clean White" },
];

// SVG Paths for Hair
export const HAIRSTYLES = [
  { 
    id: "bald", 
    label: "Bald",
    render: (color) => null
  },
  {
    id: "crop",
    label: "Crop Cut",
    render: (color) => (
      <path d="M 20 50 Q 50 10 80 50 Q 80 55 70 50 Q 50 20 30 50 Q 20 55 20 50 Z" fill={color} />
    )
  },
  {
    id: "curly",
    label: "Curly",
    render: (color) => (
      <g fill={color}>
        <circle cx="35" cy="40" r="15" />
        <circle cx="65" cy="40" r="15" />
        <circle cx="50" cy="30" r="18" />
        <circle cx="25" cy="55" r="12" />
        <circle cx="75" cy="55" r="12" />
      </g>
    )
  },
  {
    id: "spiky",
    label: "Spiky",
    render: (color) => (
      <path d="M 20 55 L 25 35 L 35 45 L 50 20 L 65 45 L 75 35 L 80 55 Q 50 40 20 55 Z" fill={color} />
    )
  },
  {
    id: "long",
    label: "Long Hair",
    render: (color) => (
      <path d="M 20 50 Q 50 15 80 50 L 85 90 Q 80 100 70 95 L 75 50 Q 50 20 25 50 L 30 95 Q 20 100 15 90 Z" fill={color} />
    )
  },
  {
    id: "bun",
    label: "Hair Bun",
    render: (color) => (
      <g fill={color}>
        <path d="M 25 50 Q 50 15 75 50 Q 50 35 25 50 Z" />
        <circle cx="50" cy="20" r="15" />
      </g>
    )
  }
];

export const FACES = [
  {
    id: "round",
    label: "Round",
    render: (skinTone) => (
      <g>
        {/* Base Face */}
        <path d="M 25 50 Q 25 90 50 90 Q 75 90 75 50 Q 75 30 50 30 Q 25 30 25 50 Z" fill={skinTone} />
        {/* Ears */}
        <circle cx="25" cy="60" r="6" fill={skinTone} />
        <circle cx="75" cy="60" r="6" fill={skinTone} />
        {/* Neck */}
        <path d="M 40 85 L 40 100 L 60 100 L 60 85 Z" fill={skinTone} style={{filter: 'brightness(0.9)'}} />
      </g>
    )
  },
  {
    id: "sharp",
    label: "Sharp",
    render: (skinTone) => (
      <g>
        <path d="M 25 50 L 35 90 L 50 95 L 65 90 L 75 50 Q 75 30 50 30 Q 25 30 25 50 Z" fill={skinTone} />
        <circle cx="23" cy="55" r="5" fill={skinTone} />
        <circle cx="77" cy="55" r="5" fill={skinTone} />
        <path d="M 42 90 L 42 100 L 58 100 L 58 90 Z" fill={skinTone} style={{filter: 'brightness(0.9)'}} />
      </g>
    )
  }
];

export const EYES = [
  {
    id: "normal",
    label: "Normal",
    render: () => (
      <g fill="#1A1A1A">
        <circle cx="38" cy="60" r="3.5" />
        <circle cx="62" cy="60" r="3.5" />
        {/* Highlights */}
        <circle cx="37" cy="59" r="1" fill="white" />
        <circle cx="61" cy="59" r="1" fill="white" />
        {/* Brows */}
        <path d="M 33 52 Q 38 50 43 53" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M 57 53 Q 62 50 67 52" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
    )
  },
  {
    id: "happy",
    label: "Happy",
    render: () => (
      <g stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M 34 60 Q 38 55 42 60" />
        <path d="M 58 60 Q 62 55 66 60" />
        <path d="M 33 50 Q 38 48 43 50" strokeWidth="2" />
        <path d="M 57 50 Q 62 48 67 50" strokeWidth="2" />
      </g>
    )
  },
  {
    id: "cool",
    label: "Cool",
    render: () => (
      <g fill="#1A1A1A">
        <path d="M 33 58 L 43 58 L 43 62 L 33 62 Z" />
        <path d="M 57 58 L 67 58 L 67 62 L 57 62 Z" />
        <path d="M 33 53 L 43 55" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" />
        <path d="M 57 55 L 67 53" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" />
      </g>
    )
  }
];

export const MOUTHS = [
  {
    id: "smile",
    label: "Smile",
    render: () => (
      <path d="M 42 75 Q 50 82 58 75" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    )
  },
  {
    id: "smirk",
    label: "Smirk",
    render: () => (
      <path d="M 43 77 Q 50 78 57 73" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    )
  },
  {
    id: "open",
    label: "Happy Open",
    render: () => (
      <path d="M 42 75 Q 50 75 58 75 Q 50 85 42 75 Z" fill="#1A1A1A" />
    )
  }
];

export const OUTFITS = [
  {
    id: "tshirt",
    label: "T-Shirt",
    render: (color) => (
      <g>
        <path d="M 25 100 Q 20 120 10 140 L 90 140 Q 80 120 75 100 Q 50 110 25 100 Z" fill={color} />
        {/* Collar */}
        <path d="M 38 100 Q 50 110 62 100" stroke={color} strokeWidth="4" style={{filter: 'brightness(0.8)'}} fill="none" />
      </g>
    )
  },
  {
    id: "hoodie",
    label: "Hoodie",
    render: (color) => (
      <g>
        {/* Base Body */}
        <path d="M 20 100 Q 15 120 5 140 L 95 140 Q 85 120 80 100 Q 50 105 20 100 Z" fill={color} />
        {/* Hood contours */}
        <path d="M 25 90 Q 10 110 20 140 M 75 90 Q 90 110 80 140" stroke={color} strokeWidth="6" style={{filter: 'brightness(0.8)'}} fill="none" />
        <path d="M 35 100 Q 50 115 65 100" stroke={color} strokeWidth="4" style={{filter: 'brightness(0.7)'}} fill="none" />
        {/* Strings */}
        <path d="M 42 110 L 42 125 M 58 110 L 58 125" stroke={color} strokeWidth="2" style={{filter: 'brightness(1.2)'}} strokeLinecap="round" />
      </g>
    )
  },
  {
    id: "jersey",
    label: "Gaming Jersey",
    render: (color) => (
      <g>
        <path d="M 25 100 Q 20 120 10 140 L 90 140 Q 80 120 75 100 Q 50 105 25 100 Z" fill={color} />
        {/* Stripes */}
        <path d="M 25 100 L 35 140 M 75 100 L 65 140" stroke="white" strokeWidth="3" opacity="0.3" />
        <path d="M 40 100 L 50 125 L 60 100" stroke="white" strokeWidth="2" opacity="0.5" fill="none" />
      </g>
    )
  }
];

export const ACCESSORIES = [
  {
    id: "none",
    label: "None",
    render: () => null
  },
  {
    id: "glasses",
    label: "Glasses",
    render: () => (
      <g stroke="#1A1A1A" strokeWidth="2.5" fill="none">
        <rect x="28" y="55" width="18" height="12" rx="3" fill="rgba(255,255,255,0.2)" />
        <rect x="54" y="55" width="18" height="12" rx="3" fill="rgba(255,255,255,0.2)" />
        <path d="M 46 60 L 54 60" />
        <path d="M 28 58 L 22 55" />
        <path d="M 72 58 L 78 55" />
      </g>
    )
  },
  {
    id: "sunglasses",
    label: "Sunglasses",
    render: () => (
      <g stroke="#1A1A1A" strokeWidth="2.5" fill="#1A1A1A">
        <rect x="28" y="55" width="18" height="12" rx="3" />
        <rect x="54" y="55" width="18" height="12" rx="3" />
        <path d="M 46 60 L 54 60" />
        <path d="M 28 58 L 22 55" />
        <path d="M 72 58 L 78 55" />
      </g>
    )
  },
  {
    id: "headphones",
    label: "Headphones",
    render: () => (
      <g fill="#0B132B">
        {/* Headband */}
        <path d="M 18 55 Q 15 20 50 20 Q 85 20 82 55" fill="none" stroke="#1A1A1A" strokeWidth="4" />
        {/* Ear cups */}
        <rect x="13" y="45" width="10" height="25" rx="4" fill="#1A1A1A" />
        <rect x="77" y="45" width="10" height="25" rx="4" fill="#1A1A1A" />
        <rect x="11" y="48" width="6" height="19" rx="2" />
        <rect x="83" y="48" width="6" height="19" rx="2" />
      </g>
    )
  },
  {
    id: "cap",
    label: "Cap",
    render: () => (
      <g>
        {/* Cap Base */}
        <path d="M 22 45 Q 50 15 78 45 Z" fill="#02006c" />
        {/* Brim */}
        <path d="M 15 45 Q 50 35 85 45 Q 50 50 15 45 Z" fill="#0B132B" />
      </g>
    )
  }
];

// Helper to get random option
export const getRandomOption = (arr) => arr[Math.floor(Math.random() * arr.length)].id;
export const getRandomColor = (arr) => arr[Math.floor(Math.random() * arr.length)].value;
