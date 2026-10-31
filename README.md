# BASTION
### A 2D Real-Time 1v1 Strategy & Base Assault Game
> **"60 Seconds to Prepare. 120 Seconds to Conquer."**

BASTION is a competitive, top-down 2D real-time strategy (RTS) game where two players compete by assembling specialized armies within an identical pool of resources (100 Command Points) and launching simultaneous assaults against pre-built, symmetrical enemy bases.

---

## 🎮 Key Features & Game Flow

1. **Equal Opportunity & Zero Grinding**:
   - Both players receive identical starting resources: **100 Command Points (CP)**.
   - Symmetrical, mirrored bases with identical defensive towers, barriers, plasma reactors, and Headquarters.
   - No base construction or worker mining — pure tactical composition and micro-execution.

2. **Phase 1: Army Selection (60 Seconds)**:
   - Spend your 100 CP budget across 6 distinct unit classes (maximum 12 units total).
   - Roster restrictions enforced: maximum 4 of any single class, maximum 2 Heavy units, maximum 2 Siege units.
   - Hidden opponent army composition until the attack phase begins.

3. **Phase 2: Battle Preparation (3 Seconds)**:
   - Final synchronized countdown with audio cues.

4. **Phase 3: Attack Phase (120 Seconds)**:
   - Deploy units from your carrier reserve directly into your forward base deployment zone.
   - Fluid RTS controls: Left-click select, marquee drag-box multi-selection, right-click move, right-click focus-fire assault.
   - Intelligent default unit AI: target preference, kiting mechanics, defensive structure auto-targeting, and collision avoidance.

5. **Phase 4: Match Results & Rematch**:
   - Win immediately upon destroying the enemy Headquarters (HQ).
   - In timeout scenarios, automated tie-breaking evaluates: % HQ Health > % Building Integrity > Total Damage Dealt.
   - Performance grading (S+, S, A, B), victory confetti, and instant 1-click rematch flow.

---

## 🛡️ Unit Roster & Balance Matrix

| Unit | Cost | HP | Speed | Range | Attack Rate | Base DMG | Tactical Role & Perks |
|---|---|---|---|---|---|---|---|
| **Scout** | 5 CP | 65 | 175 px/s | 45 px | 1.3/s | 10 | Ultra-fast harasser; rapid recon & flanking. |
| **Guardian** | 10 CP | 250 | 85 px/s | 50 px | 0.9/s | 14 | Heavy tank; **Aegis Shell** provides 25% damage reduction vs ranged attacks. |
| **Ranger** | 10 CP | 90 | 110 px/s | 230 px | 1.1/s | 18 | Kinetic sniper; **Kiting AI** steps back when melee enemies get too close. |
| **Assault** | 15 CP | 160 | 120 px/s | 85 px | 1.4/s | 24 | High sustained burst DPS across all hostile targets. |
| **Heavy** | 20 CP | 380 | 70 px/s | 55 px | 0.8/s | 42 | Frontline juggernaut; **Cleave** deals 40% splash damage to nearby hostiles (Max 2). |
| **Siege** | 20 CP | 175 | 65 px/s | 240 px | 0.5/s | 75 | Long-range mortar; **Demolitionist** deals 2.5× damage (187.5) vs towers & HQ (Max 2). |

---

## 🕹️ Controls Guide

| Action | Control |
|---|---|
| **Deploy Unit** | Click unit in bottom reserve bar → Left-click in friendly base (left zone) |
| **Select Unit** | Left-click on unit |
| **Multi-Select** | Left-click and drag marquee box |
| **Move Command** | Select units → Right-click ground |
| **Attack Command** | Select units → Right-click hostile unit or structure |
| **Audio Toggle** | Click speaker icon in top bar |
| **Concede Match** | Click "Concede" button in top bar |

---

## 🚀 Running the Project

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### 1. Start the Client
```bash
cd bastion
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### 2. Build for Production
```bash
cd bastion
npm run build
npm run preview
```

### 3. (Optional) Run Authoritative 1v1 Server
```bash
cd bastion
node server.js
```
The server runs on port 8080.
