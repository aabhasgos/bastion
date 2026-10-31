// Tekken-Inspired Commander Characters & Avatars for BASTION

export interface CommanderProfile {
  id: string;
  name: string;
  callsign: string;
  title: string;
  fightingStyle: string;
  quote: string;
  themeColor: string;
  accentColor: string;
  glowColor: string;
  avatarSvg: string;
}

export const COMMANDER_P1: CommanderProfile = {
  id: 'p1_victor',
  name: 'VICTOR VANCE',
  callsign: 'IRON FIST',
  title: 'CYBER-KARATE GRANDMASTER',
  fightingStyle: 'Mishima-Style Cybernetic Combat & Siege Tactics',
  quote: "You're not breaking through this fortress.",
  themeColor: '#0284c7',
  accentColor: '#38bdf8',
  glowColor: 'rgba(56, 189, 248, 0.6)',
  avatarSvg: `
    <svg viewBox="0 0 100 100" class="w-full h-full">
      <defs>
        <linearGradient id="p1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <!-- Head / Helm -->
      <polygon points="50,12 75,25 80,65 50,92 20,65 25,25" fill="url(#p1Grad)" stroke="#38bdf8" stroke-width="3" />
      <!-- Spiked Hair / Cyber Crest -->
      <polygon points="50,4 62,18 50,15 38,18" fill="#38bdf8" />
      <polygon points="35,12 42,22 30,22" fill="#0284c7" />
      <polygon points="65,12 58,22 70,22" fill="#0284c7" />
      <!-- Cybernetic Visor / Eye Glow -->
      <rect x="34" y="38" width="32" height="10" rx="3" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
      <circle cx="44" cy="43" r="3" fill="#38bdf8" />
      <circle cx="56" cy="43" r="3" fill="#38bdf8" />
      <!-- Jaw Armor & Faceplate -->
      <polygon points="36,60 64,60 58,80 42,80" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
      <!-- Chevrons -->
      <line x1="50" y1="64" x2="50" y2="76" stroke="#38bdf8" stroke-width="2" />
      <!-- Ear Guards -->
      <rect x="18" y="42" width="6" height="18" rx="2" fill="#38bdf8" />
      <rect x="76" y="42" width="6" height="18" rx="2" fill="#38bdf8" />
    </svg>
  `,
};

export const COMMANDER_P2: CommanderProfile = {
  id: 'p2_raven',
  name: 'RAVEN KURO',
  callsign: 'BLOOD REAPER',
  title: 'CRIMSON SHADOW OVERLORD',
  fightingStyle: 'Ninjutsu Assault & Demolition Art',
  quote: 'Your base will burn to ashes.',
  themeColor: '#dc2626',
  accentColor: '#f87171',
  glowColor: 'rgba(248, 113, 113, 0.6)',
  avatarSvg: `
    <svg viewBox="0 0 100 100" class="w-full h-full">
      <defs>
        <linearGradient id="p2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#dc2626" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <!-- Head / Horned Mask -->
      <polygon points="50,15 82,30 78,72 50,92 22,72 18,30" fill="url(#p2Grad)" stroke="#f87171" stroke-width="3" />
      <!-- Cyber Demon Horns -->
      <polygon points="25,28 10,8 35,20" fill="#f87171" stroke="#dc2626" stroke-width="1.5" />
      <polygon points="75,28 90,8 65,20" fill="#f87171" stroke="#dc2626" stroke-width="1.5" />
      <!-- Slit Visor Mask -->
      <polygon points="32,44 68,44 62,54 38,54" fill="#0f172a" stroke="#f87171" stroke-width="2" />
      <line x1="36" y1="49" x2="64" y2="49" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
      <!-- Respirator / Iron Mask Grate -->
      <polygon points="38,62 62,62 55,82 45,82" fill="#1e293b" stroke="#f87171" stroke-width="1.5" />
      <line x1="42" y1="68" x2="58" y2="68" stroke="#f87171" stroke-width="1" />
      <line x1="44" y1="74" x2="56" y2="74" stroke="#f87171" stroke-width="1" />
    </svg>
  `,
};
