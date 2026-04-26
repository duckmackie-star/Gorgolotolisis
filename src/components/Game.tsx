import React, { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  serverTimestamp,
  collection,
  addDoc
} from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Types
type GameState = 'START' | 'DIALOGUE' | 'PLAYING' | 'GAME_OVER' | 'VICTORY';

interface Modifiers {
  saladOnly: boolean;
  storm: boolean;
  superEasy: boolean;
  gunMode: boolean;
  bWinger: boolean;
  bigMode: boolean;
  randomChaos: boolean;
  mobile: boolean;
  hardMode: boolean;
  enhancedMap: boolean;
  accurateMode: boolean;
  monkCartmanMode: boolean;
  nutritionBalanceMode: boolean;
  godMode: boolean;
  aiMode: boolean;
  dimensionTear: boolean;
  blackHoleCore: boolean;
  classicMode: boolean;
}

interface Wall extends Entity {
  color: string;
}

interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Player extends Entity {
  speed: number;
  health: number;
  maxHealth: number;
  isHit: number;
  attackTimer: number;
  vx?: number;
  vy?: number;
  stunTimer: number;
}

interface Boss extends Entity {
  health: number;
  maxHealth: number;
  regenRate: number;
  speed: number;
  direction: number;
  isHit: number;
  attackTimer: number;
  corruption: number; // 0 to 1000
  state: 'NORMAL' | 'SLAMMING' | 'RISING' | 'SUMMONING_DONGFISH' | 'OREO_SANDWICH' | 'CHEF_SPIN' | 'OATMEAL_WALL' | 'ULTIMATE_SPAM' | 'CHERRY_CHARGE' | 'DIZZY' | 'RAGE' | 'WHEELCHAIR' | 'SMASH_2' | 'SODA_BLAST' | 'EARTHQUAKE_CRACK';
  slamTimer: number;
  stepTimer?: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  emoji: string;
  isPlayer: boolean;
  isHealthy: boolean;
  isDongfish?: boolean;
  isOreo?: boolean;
  isBandAid?: boolean;
  isChef?: boolean;
  isOatmeal?: boolean;
  isCherryCoke?: boolean;
  isCreamPepsi?: boolean;
  isSodaBlast?: boolean;
  isMonkBullet?: boolean;
  homingTimer?: number;
  life?: number;
  rotation: number;
  rotationSpeed: number;
  lastTeleport?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Helicopter extends Entity {
  active: boolean;
  hasPlayer: boolean;
  targetX: number;
  targetY: number;
  speed: number;
  rotation: number;
  lastShot?: number;
}

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

const HEALTHY_FOODS = ['🍎', '🥦', '🥕', '🍌', '🍇'];
const JUNK_FOODS = ['🍔', '🍟', '🥤', '🍕', '🍩', '🌭'];

const bossImage = new Image();
bossImage.src = 'https://i.postimg.cc/XqxnHNsK/htrwrwyhtytretryeqgyretgryettrewy.png';

const healthyFoodImage = new Image();
healthyFoodImage.src = 'https://hellolittlehome.com/wp-content/uploads/2022/08/garden-salad-recipe-2.jpg';

const junkFoodImage = new Image();
junkFoodImage.src = 'https://thesuburbansoapbox.com/wp-content/uploads/2022/10/Rotisserie-Chicken.jpg';

const dongfishImage = new Image();
dongfishImage.src = 'https://mediaproxy.snopes.com/width/1200/https://media.snopes.com/2021/01/Featured-Image-Templates-1.png';

const oreoImage = new Image();
oreoImage.src = 'https://images.ctfassets.net/kvfvpz4abpco/7n3VlWuCUPBuMVzlmo9Pwe/bc74da99bbbed46fc896cb5166fc81d1/oreo-footer.png?w=1920';

const chefImage = new Image();
chefImage.src = 'https://cdn11.bigcommerce.com/s-t8bvbs505h/images/stencil/500x659/products/15314623/16362193/513BO5cqdSL__33344.1615502946.jpg?c=2';

const oatmealImage = new Image();
oatmealImage.src = 'https://www.kroger.com/product/images/large/front/0002430083561';

const cartmanImage = new Image();
cartmanImage.src = 'https://i.postimg.cc/HWMQKx8t/gergergregerg.png';

const helicopterImage = new Image();
helicopterImage.src = 'https://www.pngmart.com/files/6/Helicopter-PNG-Free-Download.png';

const wheelchairImage = new Image();
wheelchairImage.src = 'https://m.media-amazon.com/images/I/81VqcLRJgXL._AC_.jpg';

const cherryCokeImage = new Image();
cherryCokeImage.src = 'https://dankmart.ca/cdn/shop/files/Coca-Cola-Cherry-Float.jpg?v=1769787380&width=1000';

const creamPepsiImage = new Image();
creamPepsiImage.src = 'https://i5.walmartimages.com/seo/Pepsi-Cola-Soda-Pop-Wild-Cherry-Cream-12-Fl-Oz-Cans-12-Pack-Packaging-May-Vary_cba0fc84-6391-4368-99d4-5886fe783d4b.186cd89a235e18f10ed883fbde560330.jpeg';

const moonImage = new Image();
moonImage.src = 'https://images.unsplash.com/photo-1532693322450-2cb5c511067d?q=80&w=2070&auto=format&fit=crop';

const blackHoleImage = new Image();
blackHoleImage.src = 'https://facts.net/wp-content/uploads/2024/10/39-facts-about-black-holes-1729698267.jpg';

const dimensionTearImage = new Image();
dimensionTearImage.src = 'https://s.yimg.com/ny/api/res/1.2/3FUfItmzFYEMujEETv_BcQ--/YXBwaWQ9aGlnaGxhbmRlcjt3PTEyMDA7aD02NzU-/https://media.zenfs.com/en/gamesradar_237/90f2bd28a3b3d2b399b9bc116a201c04';

const BACKSTORY_DIALOGUE = [
  "So... you've finally arrived at the heart of the Junk Food Realm.",
  "I am Gorgotolisis. Born from the grease of a thousand deep fryers and the sugar of a million sodas.",
  "For eons, I have watched your kind choose the easy path. The tasty path. The path of least resistance.",
  "But now, you stand before me, clutching your... salads. How quaint.",
  "Now, mortal. I offer you a choice. A simple one, really."
];

const LIVE_PATH_DIALOGUE = [
  "Hmph. You choose to live? You choose the hard way.",
  "Very well. I shall show you why they call me the Junk Food Demon.",
  "Prepare to be overwhelmed by the flavor of your own destruction!"
];

const CARTMAN_DIALOGUE = [
  "HEY! YOU! GET IN THE CHOPPER!",
  "Gorgotolisis is reaching critical mass! 500% I-Ready Test is no joke!",
  "I'm Monk Cartman, and I'm here to save your healthy hide.",
  "Don't just stand there with that salad, let's move!"
];

const CINEMATIC_TWIST_DIALOGUE = [
  "WAIT! You think this is my true form?",
  "The grease... it's evolving! It's becoming... SELF-AWARE!",
  "BEHOLD! THE ULTIMATE CALORIE OVERLOAD! YOU SHALL DROWN IN GRAVY!"
];

const SALAD_DISGUSTING_DIALOGUE = [
  "Gorgotolisis: UGH! THIS SALAD! IT'S... IT'S DISGUSTING!",
  "I CAN FEEL THE VITAMINS BURNING THROUGH MY GREASE! IT'S REVOLTING!",
  "STOP THROWING THAT NUTRITIOUS FILTH AT ME!",
  "Monk Cartman: HE'S WEAKENING! I'M COMING IN TO HELP!",
  "LET'S SHOW THIS CALORIE KING WHAT REAL STRENGTH LOOKS LIKE!"
];

const MONK_BOSS_DIALOGUE = [
  "Monk Cartman: RESPECT MY AUTHORITY... AND MY AIR SUPERIORITY!",
  "Your salads can't reach me up here in my tactical helicopter!",
  "I have been training in the mountains of tranquility AND pilot school!",
  "Prepare to face the true power of discipline... FROM THE SKY!"
];

const MODIFIER_DEFS = [
  { id: 'saladOnly', name: 'Salad Storm', image: 'https://hellolittlehome.com/wp-content/uploads/2022/08/garden-salad-recipe-2.jpg', desc: 'Mostly healthy projectiles' },
  { id: 'storm', name: 'The Border', image: 'https://progameguides.com/wp-content/uploads/2018/12/fortnite-loading-screen-storm-king.jpg', desc: 'Storm border closes in' },
  { id: 'superEasy', name: 'Easy Mode', image: 'https://cdn.thecelebritist.com/735418da3259d9f0a71c2972ca6d88dab383cea1c557b129ab6f6142b3affd5c.jpg', desc: 'Higher player health' },
  { id: 'gunMode', name: 'Gun Mode', image: 'https://techiesportsdadreviews.com/wp-content/uploads/2024/07/water-guns-for-kids-6-pack-squirt-guns-water-soaker-blaster-220cc-capacity-15-20-feet-shooting-range-water-gun-for-boys-1-3.jpg', desc: 'Shoot back with SPACE' },
  { id: 'bWinger', name: 'B-Winger', image: 'https://m.media-amazon.com/images/I/81VqcLRJgXL._AC_.jpg', desc: 'Dizzy boss & accuracy penalty' },
  { id: 'bigMode', name: 'Big Mode', image: 'https://www.ixpap.com/images/2024/12/CaseOh-Wallpaper-3.jpeg', desc: 'Huge boss & earthquake steps' },
  { id: 'randomChaos', name: 'Chaos Mode', image: 'https://images-na.ssl-images-amazon.com/images/I/71TAbWwHV7L._AC_SL1500_.jpg', desc: 'Random round modifiers' },
  { id: 'mobile', name: 'Mobile View', image: 'https://s3b.cashify.in/gpro/uploads/2022/09/06141907/The-Latest-Xiaomi-Smartphones.jpg', desc: 'On-screen d-pad' },
  { id: 'hardMode', name: 'INSANE Mode', image: 'https://c.pxhere.com/photos/aa/f5/grave_stones_forest_cemetery_stuttgart_cemetery_woodland_cemetery_graves_soldiers_graves_resting_place_last_calm-891459.jpg!d', desc: 'Dodge, Stun, Cracks, NO MERCY' },
  { id: 'enhancedMap', name: 'Enhanced Map', image: 'https://cf-images.us-east-1.prod.boltdns.net/v1/static/77374810001/bcd159b7-f6e0-4d81-ae99-529bb732c6a5/d45c9715-7f4c-4593-8da4-b25a97100783/1280x720/match/image.jpg', desc: 'Dynamic walls and cover' },
  { id: 'accurateMode', name: 'Accurate Mode', image: 'https://i.pinimg.com/736x/70/43/dd/7043dd8748922271e7567e9d9e38a0ca.jpg', desc: 'Slow boss, 75% I-Ready cap, salad rage' },
  { id: 'monkCartmanMode', name: 'Monk Cartman Boss', image: 'https://i.postimg.cc/HWMQKx8t/gergergregerg.png', desc: 'Fight the Monk instead of the Demon' },
  { id: 'nutritionBalanceMode', name: 'Nutrition Balance', image: 'https://img.freepik.com/premium-vector/healthy-balanced-diet-plate-featuring-fresh-organic-vegetables-fruits-protein-grains-nuts-see_597121-40054.jpg?w=2000', desc: 'Maintain the balance between healthy and junk' },
  { id: 'godMode', name: 'God Mode', image: 'https://i.pinimg.com/736x/c8/1d/c3/c81dc3dd44d0791292bef70634f33965.jpg', desc: 'Invincibility: You cannot take damage' },
  { id: 'aiMode', name: 'AI Director', image: 'https://4kwallpapers.com/images/walls/thumbs_3t/18721.png', desc: 'Gemini controls the boss dynamically!' },
  { id: 'blackHoleCore', name: 'Black Hole Core', image: 'https://facts.net/wp-content/uploads/2024/10/39-facts-about-black-holes-1729698267.jpg', desc: 'Center of screen pulls EVERYTHING in' },
  { id: 'dimensionTear', name: 'Dimension Tear', image: 'https://s.yimg.com/ny/api/res/1.2/3FUfItmzFYEMujEETv_BcQ--/YXBwaWQ9aGlnaGxhbmRlcjt3PTEyMDA7aD02NzU-/https://media.zenfs.com/en/gamesradar_237/90f2bd28a3b3d2b399b9bc116a201c04', desc: 'Dimension tears teleport food' },
  { id: 'classicMode', name: 'Classic Mode', image: 'https://i.imgflip.com/2/84ulrr.jpg', desc: 'Original experience: Boss Phases, Runner skin only, No soda attacks' },
] as const;

const SHOP_SKINS = [
  { id: '🏃', type: 'emoji', value: '🏃', name: 'Runner', price: 0 },
  { id: '🥗', type: 'image', value: 'https://hellolittlehome.com/wp-content/uploads/2022/08/garden-salad-recipe-2.jpg', name: 'Salad', price: 25 },
  { id: '🍪', type: 'image', value: 'https://images.ctfassets.net/kvfvpz4abpco/7n3VlWuCUPBuMVzlmo9Pwe/bc74da99bbbed46fc896cb5166fc81d1/oreo-footer.png?w=1920', name: 'Oreo', price: 25 },
  { id: '🍗', type: 'image', value: 'https://www.spendwithpennies.com/wp-content/uploads/2020/05/1200-Rotisserie-Chicken-SpendWithPennies-11.jpg', name: 'Chicken', price: 25 },
  { id: 'monk_cartman', type: 'image', value: 'https://i.postimg.cc/HWMQKx8t/gergergregerg.png', name: 'Monk Cartman', price: 50 },
  { id: 'b_winger', type: 'image', value: 'https://m.media-amazon.com/images/I/81VqcLRJgXL._AC_.jpg', name: 'B Winger', price: 150 },
  { id: 'money', type: 'image', value: 'https://media.istockphoto.com/id/135194728/photo/rolling-in-the-money.jpg?s=1024x1024&w=is&k=20&c=Q7-e8Tcu5CV8nUZgAY5BloFUddWqPVvm1kO5hwGzfTA=', name: 'Money', price: 200 },
  { id: 'vip_crown', type: 'emoji', value: '👑', name: 'VIP Crown', price: 9999 },
] as const;

const skinImages: Record<string, HTMLImageElement> = {};
SHOP_SKINS.forEach(skin => {
  if (skin.type === 'image') {
    const img = new Image();
    img.src = skin.value;
    skinImages[skin.id] = img;
  }
});

const UPGRADE_SHOP = [
  { id: 'maxHealth', name: 'Health Boost', desc: 'Start with +25 Max Health', icon: '❤️', price: 50, maxLevel: 10 },
  { id: 'speed', name: 'Speed Boost', desc: 'Move +25 units faster', icon: '⚡', price: 75, maxLevel: 10 },
  { id: 'coinMulti', name: 'Coin Magnet', desc: 'Earn +50% extra coins', icon: '✨', price: 150, maxLevel: 4 },
  { id: 'healthRegen', name: 'Passive Regen', desc: 'Heal +1 HP per second', icon: '🍃', price: 200, maxLevel: 5 },
] as const;

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLVideoElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [modifiers, setModifiers] = useState<Modifiers>({
    saladOnly: false,
    storm: false,
    superEasy: false,
    gunMode: false,
    bWinger: false,
    bigMode: false,
    randomChaos: false,
    mobile: false,
    hardMode: false,
    enhancedMap: false,
    accurateMode: false,
    monkCartmanMode: false,
    nutritionBalanceMode: false,
    godMode: false,
    aiMode: false,
    blackHoleCore: false,
    dimensionTear: false,
    classicMode: false,
  });
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [adminCorruption, setAdminCorruption] = useState(0);
  const [isGodModeActive, setIsGodModeActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [dialogueMode, setDialogueMode] = useState<'BACKSTORY' | 'LIVE_PATH' | 'CARTMAN' | 'TWIST' | 'SALAD_DISGUSTING' | 'MONK_BOSS' | 'INTRO_CINEMATIC'>('INTRO_CINEMATIC');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const isOnMoon = useRef(false);
  const dimensionsRef = useRef({ width: 800, height: 600 });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch/Create profile
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setProfile(userSnap.data());
        } else {
          const newProfile = {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            totalScore: 0,
            highScore: 0,
            bossDefeats: 0,
            coins: 0,
            unlockedModifiers: MODIFIER_DEFS.map(m => m.id),
            unlockedSkins: ['🏃'],
            selectedSkin: '🏃',
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp()
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const saveGameSession = async (result: 'VICTORY' | 'GAME_OVER', finalScore: number) => {
    if (!user) return;
    
    try {
      // 1. Log session
      await addDoc(collection(db, 'sessions'), {
        userId: user.uid,
        score: finalScore,
        result,
        activeModifiers: Object.entries(modifiers)
          .filter(([_, active]) => active)
          .map(([id]) => id),
        timestamp: serverTimestamp()
      });

      // 2. Update user profile
      const userRef = doc(db, 'users', user.uid);
      const isVictory = result === 'VICTORY';
      // VICTORY CALCULATION
      const upgCoinMulti = profile?.upgrades?.coinMulti || 0;
      const baseCoins = Math.floor(finalScore / 10) + (isVictory ? 50 : 0);
      const vipMulti = profile?.isVip ? 2 : 1;
      const coinsEarned = Math.floor(baseCoins * (1 + (upgCoinMulti * 0.5)) * vipMulti);
      
      const updates: any = {
        totalScore: increment(finalScore),
        coins: increment(coinsEarned),
        lastActive: serverTimestamp(),
        // Just in case existing users miss certain modifiers (forces all to be unlocked)
        unlockedModifiers: MODIFIER_DEFS.map(m => m.id)
      };

      if (finalScore > (profile?.highScore || 0)) {
        updates.highScore = finalScore;
      }
      if (isVictory) {
        updates.bossDefeats = increment(1);
      }

      await updateDoc(userRef, updates);
      
      // Refresh local profile
      const userSnap = await getDoc(userRef);
      setProfile(userSnap.data());
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  };

  // Game state refs (mutable to avoid re-renders)
  const keys = useRef<{ [key: string]: boolean }>({});
  const mousePos = useRef({ x: 0, y: 0 });
  const isMouseDown = useRef(false);
  const lastShotTime = useRef(0);
  const godMode = useRef(false);
  const cheatBuffer = useRef('');
  const projectileSpeedMult = useRef(1);
  const isBossFrozen = useRef(false);
  const infiniteHealth = useRef(false);
  const isControllingBoss = useRef(false);
  const hasTriggeredCartman = useRef(false);
  const isRescueEnding = useRef(false);
  const deflectedSalads = useRef(0);
  const hasTriggeredSaladDialogue = useRef(false);
  const pinchTriggered = useRef(false);
  const balanceLevel = useRef(0); // -100 to 100 for Nutrition Balance Mode
  const stormRadius = useRef(WORLD_WIDTH / 1.5);
  const screenShake = useRef(0);
  const cameraZoom = useRef(1);
  const plotTwistTriggered = useRef(false);
  const cinematicTimer = useRef(0);
  const lastAITick = useRef(0);
  const aiDecision = useRef<Boss['state'] | ''>('');
  const chaosModifiers = useRef({
    lowGravity: false,
    doubleSpeed: false,
    invertedControls: false,
    giantBoss: false,
    tinyPlayer: false,
  });
  const [activeModifiers, setActiveModifiers] = useState<string[]>([]);
  const [menuTab, setMenuTab] = useState<'modifiers' | 'skins' | 'upgrades'>('modifiers');
  const currentSkin = useRef('🏃');
  const dimensionTears = useRef<{ x: number, y: number, radius: number, partnerIndex: number }[]>([]);
  
  useEffect(() => {
    currentSkin.current = modifiers.classicMode ? '🏃' : (profile?.selectedSkin || '🏃');
  }, [profile?.selectedSkin, modifiers.classicMode]);
  
  const player = useRef<Player>({
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    width: 40,
    height: 40,
    speed: 350,
    health: 100,
    maxHealth: 100,
    isHit: 0,
    attackTimer: 0,
  });

  const boss = useRef<Boss>({
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2 - 300,
    width: 140,
    height: 140,
    health: 1500,
    maxHealth: 1500,
    regenRate: 20, // Health per second
    speed: 120,
    direction: 1,
    isHit: 0,
    attackTimer: 0,
    phase: 1,
    state: 'NORMAL',
    slamTimer: 5,
  });

  const helicopter = useRef<Helicopter>({
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    active: false,
    hasPlayer: false,
    targetX: 0,
    targetY: 0,
    speed: 400,
    rotation: 0,
  });

  const projectiles = useRef<Projectile[]>([]);
  const particles = useRef<Particle[]>([]);
  const walls = useRef<Wall[]>([]);
  
  const lastTime = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const activeBossImage = useRef<HTMLImageElement>(bossImage);

  const initGame = async () => {
    if (modifiers.aiMode) {
      const cooldownMins = profile?.isVip ? 10 : 15;
      if (profile && profile.lastAIPlay && Date.now() - profile.lastAIPlay < cooldownMins * 60 * 1000) {
        alert(`AI Director Mode is cooling down! Playable every ${cooldownMins} minutes.`);
        return;
      }
      if (!user) {
        alert('You must be signed in to play AI Director Mode so we can track the cooldown.');
        return;
      }
      try {
        await updateDoc(doc(db, 'users', user.uid), { lastAIPlay: Date.now() });
        setProfile({...profile, lastAIPlay: Date.now()});
      } catch (e) {
        console.error("Failed to update AI cooldown", e);
      }
    }

    const isEasy = modifiers.superEasy;
    const isHard = modifiers.hardMode;
    
    // Calculate Upgrades
    const upgHealth = (profile?.upgrades?.maxHealth || 0) * 25;
    const upgSpeed = (profile?.upgrades?.speed || 0) * 25;
    const vipHealth = profile?.isVip ? 100 : 0;
    
    const startX = WORLD_WIDTH / 2;
    const startY = modifiers.blackHoleCore ? WORLD_HEIGHT / 2 + 600 : WORLD_HEIGHT / 2;

    player.current = { 
      ...player.current, 
      x: startX, 
      y: startY, 
      health: (isEasy ? 1000 : (isHard ? 75 : 100)) + upgHealth + vipHealth, 
      maxHealth: (isEasy ? 1000 : (isHard ? 75 : 100)) + upgHealth + vipHealth, 
      speed: 350 + upgSpeed,
      isHit: 0,
      attackTimer: 0,
      vx: 0,
      vy: 0,
      stunTimer: 0
    };
    
    const bossHp = isHard ? 10000 : 5000;
    activeBossImage.current = modifiers.monkCartmanMode ? helicopterImage : bossImage;
    boss.current = { 
      ...boss.current, 
      x: WORLD_WIDTH / 2, 
      y: WORLD_HEIGHT / 2 - 300, 
      health: bossHp, 
      maxHealth: bossHp, 
      regenRate: isHard ? 30 : 15, 
      speed: modifiers.accurateMode ? 60 : (isHard ? 180 : 120),
      width: modifiers.monkCartmanMode ? 220 : 140,
      height: modifiers.monkCartmanMode ? 140 : 140,
      isHit: 0, 
      attackTimer: 0, 
      corruption: isHard ? 200 : 0, 
      state: 'NORMAL', 
      slamTimer: 5 
    };

    if (modifiers.monkCartmanMode) {
      setDialogueMode('MONK_BOSS');
      setDialogueIndex(0);
      setGameState('DIALOGUE');
    }
    
    helicopter.current = {
      ...helicopter.current,
      active: false,
      hasPlayer: false,
    };
    hasTriggeredCartman.current = false;
    deflectedSalads.current = 0;
    hasTriggeredSaladDialogue.current = false;
    pinchTriggered.current = false;
    balanceLevel.current = 0;
    isRescueEnding.current = false;
    stormRadius.current = WORLD_WIDTH / 1.5;
    screenShake.current = 0;
    cameraZoom.current = 1;
    plotTwistTriggered.current = false;
    cinematicTimer.current = 0;
    isOnMoon.current = false;
    projectiles.current = [];
    particles.current = [];
    walls.current = [];
    hasTriggeredCartman.current = false;

    // Wall Generation
    if (modifiers.enhancedMap) {
      for (let i = 0; i < 20; i++) {
        const w = 150 + Math.random() * 400;
        const h = 150 + Math.random() * 400;
        const x = Math.random() * (WORLD_WIDTH - w);
        const y = Math.random() * (WORLD_HEIGHT - h);
        
        // Don't spawn walls inside player/boss starting area
        const distToStart = Math.hypot(x + w / 2 - WORLD_WIDTH / 2, y + h / 2 - WORLD_HEIGHT / 2);
        if (distToStart > 600) {
          walls.current.push({ x, y, width: w, height: h, color: '#334155' });
        }
      }
    }

    // Chaos Mode Initialization
    if (modifiers.randomChaos) {
      const mods = {
        lowGravity: Math.random() < 0.3,
        doubleSpeed: Math.random() < 0.3,
        invertedControls: Math.random() < 0.3,
        giantBoss: Math.random() < 0.3,
        tinyPlayer: Math.random() < 0.3,
      };
      
      // Ensure at least one mod is active
      if (!Object.values(mods).some(Boolean)) {
        mods.doubleSpeed = true;
      }
      
      chaosModifiers.current = mods;
      
      const activeList: string[] = [];
      if (mods.lowGravity) activeList.push('Floating Feasts (Low Gravity)');
      if (mods.doubleSpeed) activeList.push('Turbo Terror (Double Speed)');
      if (mods.invertedControls) activeList.push('Confused Cravings (Inverted Controls)');
      if (mods.giantBoss) activeList.push('EXTREME GORGOTOLISIS (Giant Boss)');
      if (mods.tinyPlayer) activeList.push('Bite-Sized Hero (Tiny Player)');
      setActiveModifiers(activeList);
      
      if (mods.giantBoss) {
        boss.current.width *= 2.5;
        boss.current.height *= 2.5;
        boss.current.health *= 1.5;
        boss.current.maxHealth *= 1.5;
      }
      if (mods.tinyPlayer) {
        player.current.width *= 0.5;
        player.current.height *= 0.5;
      }
    } else {
      chaosModifiers.current = {
        lowGravity: false,
        doubleSpeed: false,
        invertedControls: false,
        giantBoss: false,
        tinyPlayer: false,
      };
      setActiveModifiers([]);
    }

    // Dimension Tears
    dimensionTears.current = [];
    if (modifiers.dimensionTear) {
      for (let i = 0; i < 2; i++) {
        const x1 = 500 + Math.random() * (WORLD_WIDTH - 1000);
        const y1 = 500 + Math.random() * (WORLD_HEIGHT - 1000);
        const x2 = 500 + Math.random() * (WORLD_WIDTH - 1000);
        const y2 = 500 + Math.random() * (WORLD_HEIGHT - 1000);
        const idx = dimensionTears.current.length;
        dimensionTears.current.push({ x: x1, y: y1, radius: 120, partnerIndex: idx + 1 });
        dimensionTears.current.push({ x: x2, y: y2, radius: 120, partnerIndex: idx });
      }
    }

    setDialogueMode('INTRO_CINEMATIC');
    setDialogueIndex(0);
    setGameState('DIALOGUE');
    setIsPaused(false);

    setMusicPlaying(true);
  };

  const stopGame = (result: GameState) => {
    setGameState(result);
    setMusicPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (result === 'VICTORY' || result === 'GAME_OVER') {
      const finalScore = Math.floor(boss.current.corruption + player.current.health);
      saveGameSession(result === 'VICTORY' ? 'VICTORY' : 'GAME_OVER', finalScore);
    }
  };

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.5,
        color,
        size: Math.random() * 5 + 2,
      });
    }
  };

  const fetchAIDecision = async () => {
    try {
      const pX = Math.round(player.current.x);
      const bX = Math.round(boss.current.x);
      const pHp = Math.round(player.current.health);
      const bHp = Math.round(boss.current.health);
      const corr = Math.round(boss.current.corruption);
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: `You are the malicious final boss director in a 2D bullet hell game. 
Player X: ${pX}. Boss X: ${bX}. 
Player HP: ${pHp}/100. Boss HP: ${bHp}. Corruption: ${corr}.
Choose your next attack state to ruin the player's day.
Available states: 'NORMAL', 'SLAMMING' (chase dash), 'OATMEAL_WALL' (defensive), 'CHEF_SPIN' (AoE), 'CHERRY_CHARGE' (fast dash), 'SUMMONING_DONGFISH', 'OREO_SANDWICH', 'ULTIMATE_SPAM' (panic).
Return ONLY the exact state name from the list above. No quotes, no markdown, no explanation.`,
        config: {
          systemInstruction: "You are a merciless game logic AI.",
          temperature: 0.9,
          maxOutputTokens: 10,
        }
      });
      
      const text = response.text?.trim().toUpperCase();
      const validStates = ['SLAMMING', 'OATMEAL_WALL', 'CHEF_SPIN', 'CHERRY_CHARGE', 'SUMMONING_DONGFISH', 'ULTIMATE_SPAM', 'NORMAL', 'OREO_SANDWICH'];
      
      if (text && validStates.includes(text)) {
         aiDecision.current = text as Boss['state'];
      }
    } catch (e) {
       console.error("AI fetch failed, falling back to random", e);
    }
  };

  const update = (dt: number) => {
    if (gameState !== 'PLAYING' || isPaused) return;

    if (modifiers.accurateMode && !pinchTriggered.current && deflectedSalads.current >= 12) {
      pinchTriggered.current = true;
      player.current.health = 1;
      screenShake.current = 60;
      spawnParticles(player.current.x, player.current.y, '#ff0000', 50);
    }

    // CHAOS: Double Speed
    if (modifiers.randomChaos && chaosModifiers.current.doubleSpeed) {
      dt *= 2;
    }

    cinematicTimer.current += dt;

    if (modifiers.hardMode) {
      // Hard mode "SUFFER" effect every 12s - clears healthy food
      if (Math.floor(cinematicTimer.current / 12) > Math.floor((cinematicTimer.current - dt) / 12)) {
        projectiles.current = projectiles.current.filter(p => !p.isHealthy);
        screenShake.current = 60;
      }
    }

    const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = dimensionsRef.current;

    if (screenShake.current > 0) {
      screenShake.current -= 20 * dt;
    }

    // Player movement
    let dx = 0;
    let dy = 0;

    if (player.current.stunTimer > 0) {
      player.current.stunTimer -= dt;
    } else {
      if (keys.current['w'] || keys.current['arrowup']) dy -= 1;
      if (keys.current['s'] || keys.current['arrowdown']) dy += 1;
      if (keys.current['a'] || keys.current['arrowleft']) dx -= 1;
      if (keys.current['d'] || keys.current['arrowright']) dx += 1;
    }

    // CHAOS: Inverted Controls
    if (modifiers.randomChaos && chaosModifiers.current.invertedControls) {
      dx *= -1;
      dy *= -1;
    }

    // CHAOS: Low Gravity (Drifty physics)
    if (modifiers.randomChaos && chaosModifiers.current.lowGravity) {
      player.current.speed = 1500; // High speed but with resistance
      // We apply logic later to keep momentum
    } else {
      player.current.speed = 350;
    }

    // Normalizing diagonal movement
    if (dx !== 0 && dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
    }

    if (isControllingBoss.current) {
      // Boss control movement
      boss.current.x += dx * player.current.speed * dt;
      boss.current.y += dy * player.current.speed * dt;
      // Player follows boss or stays put? Let's make player follow boss for convenience
      player.current.x = boss.current.x;
      player.current.y = boss.current.y;
    } else {
      if (modifiers.randomChaos && chaosModifiers.current.lowGravity) {
        // Drifty movement: speed is treated as acceleration
        const friction = 2.0;
        const accel = 1200;
        player.current.vx = (player.current.vx || 0) + dx * accel * dt;
        player.current.vy = (player.current.vy || 0) + dy * accel * dt;
        player.current.vx *= (1 - friction * dt);
        player.current.vy *= (1 - friction * dt);
        player.current.x += player.current.vx * dt;
        player.current.y += player.current.vy * dt;
      } else {
        player.current.x += dx * player.current.speed * dt;
        player.current.y += dy * player.current.speed * dt;
      }
    }

    // Clamp player to world
    player.current.x = Math.max(player.current.width / 2, Math.min(WORLD_WIDTH - player.current.width / 2, player.current.x));
    player.current.y = Math.max(player.current.height / 2, Math.min(WORLD_HEIGHT - player.current.height / 2, player.current.y));

    // Wall collisions for player
    if (modifiers.enhancedMap) {
      walls.current.forEach(w => {
        const px = player.current.x;
        const py = player.current.y;
        const hw = player.current.width / 2;
        const hh = player.current.height / 2;

        if (px + hw > w.x && px - hw < w.x + w.width && py + hh > w.y && py - hh < w.y + w.height) {
          const overlapLeft = (px + hw) - w.x;
          const overlapRight = (w.x + w.width) - (px - hw);
          const overlapTop = (py + hh) - w.y;
          const overlapBottom = (w.y + w.height) - (py - hh);

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          if (minOverlap === overlapLeft) player.current.x -= overlapLeft;
          else if (minOverlap === overlapRight) player.current.x += overlapRight;
          else if (minOverlap === overlapTop) player.current.y -= overlapTop;
          else if (minOverlap === overlapBottom) player.current.y += overlapBottom;
        }
      });
    }

    if (isControllingBoss.current) {
      boss.current.x = player.current.x;
      boss.current.y = player.current.y;
    }

    // Calculate camera position
    const cameraX = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, player.current.x - CANVAS_WIDTH / 2));
    const cameraY = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, player.current.y - CANVAS_HEIGHT / 2));

    // Gun Mode shooting
    if (modifiers.gunMode) {
      player.current.attackTimer -= dt;
      if (keys.current[' '] && player.current.attackTimer <= 0) {
        // Shoot toward mouse
        const angle = Math.atan2(mousePos.current.y + cameraY - player.current.y, mousePos.current.x + cameraX - player.current.x);
        projectiles.current.push({
          x: player.current.x,
          y: player.current.y,
          vx: Math.cos(angle) * 1000,
          vy: Math.sin(angle) * 1000,
          radius: 10,
          emoji: '🔫',
          isPlayer: true,
          isHealthy: false,
          rotation: angle,
          rotationSpeed: 0,
        });
        player.current.attackTimer = 0.15; // Fire rate
      }
    }

    // Storm logic
    if (modifiers.storm) {
      // Shrink storm
      stormRadius.current = Math.max(300, stormRadius.current - 15 * dt);
      
      // Check if player is outside storm
      const dx = player.current.x - WORLD_WIDTH / 2;
      const dy = player.current.y - WORLD_HEIGHT / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > stormRadius.current) {
        // Damage player
        player.current.health -= 5 * dt;
        player.current.isHit = 0.1;
        if (player.current.health <= 0) {
          stopGame('GAME_OVER');
        }
      }
    }

    // Helicopter logic
    if (helicopter.current.active) {
      const h = helicopter.current;

      // Accurate Mode: Cartman helps fight
      if (modifiers.accurateMode && !h.hasPlayer) {
        h.targetX = player.current.x;
        h.targetY = player.current.y - 150;
        
        // Shoot at boss
        const now = performance.now();
        if (!h.lastShot) h.lastShot = 0;
        if (now - h.lastShot > 150) { // Fast firing
          const bulletAngle = Math.atan2(boss.current.y - h.y, boss.current.x - h.x);
          projectiles.current.push({
            x: h.x,
            y: h.y,
            vx: Math.cos(bulletAngle) * 1200,
            vy: Math.sin(bulletAngle) * 1200,
            radius: 12,
            emoji: '🥗', // He shoots healthy food!
            isPlayer: true,
            isHealthy: true,
            rotation: 0,
            rotationSpeed: 20
          });
          h.lastShot = now;
        }
      }

      if (!h.hasPlayer) {
        // Fly to target position near player
        const dx = h.targetX - h.x;
        const dy = h.targetY - h.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
          h.x += (dx / dist) * h.speed * dt;
          h.y += (dy / dist) * h.speed * dt;
        }

        // Check collision with player
        const pdx = player.current.x - h.x;
        const pdy = player.current.y - h.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pdist < 80) {
          h.hasPlayer = true;
          h.targetY = h.y - 2000; // Fly away up
          h.targetX = h.x + 1000; // And right
        }
      } else {
        // Flying away
        const dx = h.targetX - h.x;
        const dy = h.targetY - h.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        h.x += (dx / dist) * h.speed * 2 * dt;
        h.y += (dy / dist) * h.speed * 2 * dt;
        
        // Player follows helicopter
        player.current.x = h.x;
        player.current.y = h.y + 30;

        // Trigger explosion and end when high enough
        if (h.y < cameraY - 200 && !isRescueEnding.current) {
          isRescueEnding.current = true;
          // Massive explosion at boss location
          for (let i = 0; i < 200; i++) {
            spawnParticles(boss.current.x + (Math.random() - 0.5) * 400, boss.current.y + (Math.random() - 0.5) * 400, '#ff4400', 1);
          }
          boss.current.health = 0;
          setTimeout(() => {
            setGameState('VICTORY');
          }, 1000);
        }
      }
    }

    // Boss movement & State Machine
    const corruptionFactor = boss.current.corruption / 100;

    if (modifiers.bigMode) {
      boss.current.width = 400;
      boss.current.height = 400;
      
      // Step earthquake
      boss.current.stepTimer = (boss.current.stepTimer || 0) - dt;
      if (boss.current.stepTimer <= 0) {
        screenShake.current = 15;
        boss.current.stepTimer = 0.8; // Every step
      }

      // Soda blaster trigger if mad (high I-Ready score)
      if (boss.current.corruption >= 700 && boss.current.state !== 'SODA_BLAST' && !isOnMoon.current) {
        boss.current.state = 'SODA_BLAST';
        boss.current.slamTimer = 6;
        boss.current.attackTimer = 0;
      }
    }

    // B Winger I-Ready Test decay
    if (modifiers.bWinger) {
      boss.current.corruption = Math.max(0, boss.current.corruption - 10 * dt); // 1% of 1000 per second
    }

    if (modifiers.nutritionBalanceMode) {
      // Natural drift towards 0
      if (balanceLevel.current > 0) balanceLevel.current = Math.max(0, balanceLevel.current - 10 * dt);
      if (balanceLevel.current < 0) balanceLevel.current = Math.min(0, balanceLevel.current + 10 * dt);

      // Malnutrition damage if unbalanced
      if (Math.abs(balanceLevel.current) > 80) {
        player.current.health -= 5 * dt;
        if (Math.floor(performance.now() / 200) % 2 === 0) {
          spawnParticles(player.current.x, player.current.y, balanceLevel.current > 0 ? '#4ade80' : '#ef4444', 1);
        }
        if (player.current.health <= 0) stopGame('GAME_OVER');
      }
    }
    
    if (boss.current.corruption >= 500 && !hasTriggeredCartman.current && !isControllingBoss.current && !modifiers.monkCartmanMode) {
      hasTriggeredCartman.current = true;
      setDialogueMode('CARTMAN');
      setDialogueIndex(0);
      setGameState('DIALOGUE');
      return;
    }

    if (isControllingBoss.current) {
      // Manual boss attacks
      if (keys.current['1']) boss.current.state = 'NORMAL';
      if (keys.current['2']) boss.current.state = 'SLAMMING';
      if (keys.current['3']) boss.current.state = 'OATMEAL_WALL';
      if (keys.current['4']) boss.current.state = 'CHEF_SPIN';
      if (keys.current['5']) boss.current.state = 'SUMMONING_DONGFISH';
      if (keys.current['6']) boss.current.state = 'OREO_SANDWICH';
      if (keys.current['7']) boss.current.state = 'ULTIMATE_SPAM';
      if (keys.current['8']) boss.current.state = 'CHERRY_CHARGE';
      
      // Auto-shoot in normal state if mouse is down
      if (boss.current.state === 'NORMAL') {
        boss.current.attackTimer -= dt;
        if (boss.current.attackTimer <= 0 && isMouseDown.current) {
          const angle = Math.atan2(mousePos.current.y + cameraY - boss.current.y, mousePos.current.x + cameraX - boss.current.x);
          const numProjectiles = 3 + Math.floor(corruptionFactor * 6);
          for (let i = 0; i < numProjectiles; i++) {
            const spreadOffset = (i - Math.floor(numProjectiles / 2)) * 0.15;
            const spreadAngle = angle + spreadOffset;
            const isHealthy = modifiers.saladOnly;
            projectiles.current.push({
              x: boss.current.x,
              y: boss.current.y,
              vx: Math.cos(spreadAngle) * 500 * projectileSpeedMult.current,
              vy: Math.sin(spreadAngle) * 500 * projectileSpeedMult.current,
              radius: 20,
              emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)],
              isPlayer: false,
              isHealthy: isHealthy,
              rotation: 0,
              rotationSpeed: (Math.random() - 0.5) * 8,
            });
          }
          boss.current.attackTimer = 0.2;
        }
      }
    } else if (isBossFrozen.current) {
      // Boss is frozen, do nothing
    } else if (boss.current.state === 'NORMAL') {
      // Follow the player - constant speed
      let currentSpeed = boss.current.speed;
      if (modifiers.hardMode) currentSpeed *= 1.6;

      const angleToPlayer = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
      
      let moveDirX = Math.cos(angleToPlayer);
      let moveDirY = Math.sin(angleToPlayer);

      // Dodging in Hard Mode
      if (modifiers.hardMode) {
        projectiles.current.forEach(p => {
          if (p.isPlayer || p.isHealthy) {
            const distSq = (p.x - boss.current.x) ** 2 + (p.y - boss.current.y) ** 2;
            if (distSq < 160000) { // 400px range
              const projAngle = Math.atan2(p.vy, p.vx);
              moveDirX += Math.cos(projAngle + Math.PI / 2) * 6;
              moveDirY += Math.sin(projAngle + Math.PI / 2) * 6;
            }
          }
        });
        
        // Normalize again after dodging logic
        const mag = Math.sqrt(moveDirX * moveDirX + moveDirY * moveDirY);
        if (mag > 0) {
          moveDirX /= mag;
          moveDirY /= mag;
        }
      }

      boss.current.x += moveDirX * currentSpeed * dt;
      boss.current.y += moveDirY * currentSpeed * dt;

      // Monk Cartman Boss Swaying
      if (modifiers.monkCartmanMode) {
        boss.current.x += Math.sin(performance.now() / 200) * 100 * dt;
        boss.current.y += Math.cos(performance.now() / 400) * 50 * dt;
      }

      // Boss shooting - amount scales with corruption, but frequency stays constant
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        let angle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
        
        // B Winger miss logic
        if (modifiers.bWinger) {
          angle += (Math.random() - 0.5) * 0.8; // Add significant inaccuracy
        }

        const isEasy = modifiers.superEasy;
        const numProjectiles = (3 + Math.floor(corruptionFactor * 6) + Math.floor(Math.random() * 2));
        
        if (modifiers.monkCartmanMode) {
          // Monk Cartman Bullet Logic - Rapid Fire
          const bulletAngle = angle + (Math.random() - 0.5) * 0.1;
          const isHealthy = Math.random() < 0.1; // 10% chance for a "healthy" projectile to deflect back
          
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(bulletAngle) * 1100,
            vy: Math.sin(bulletAngle) * 1100,
            radius: isHealthy ? 20 : 10,
            emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : '🔥', 
            isPlayer: false,
            isHealthy: isHealthy,
            isMonkBullet: !isHealthy,
            rotation: bulletAngle,
            rotationSpeed: isHealthy ? 5 : 0,
          });
          boss.current.attackTimer = 0.1; // Very fast
        } else {
          for (let i = 0; i < numProjectiles; i++) {
            const spreadOffset = (i - Math.floor(numProjectiles / 2)) * Math.max(0.1, 0.25 - corruptionFactor * 0.01);
            const spreadAngle = angle + spreadOffset;
            
            let isHealthy = Math.random() < Math.max(0.04, 0.15 - corruptionFactor * 0.01); // Minimum 4% chance
            if (modifiers.saladOnly) isHealthy = true;
            if (modifiers.nutritionBalanceMode) isHealthy = Math.random() < 0.5; // Exactly 50/50 balance
            if (modifiers.bWinger) {
              isHealthy = Math.random() < 0.35; // Much higher chance of salads
            }
            
            const isBandAid = !isHealthy && Math.random() < 0.05; // 5% chance if it's not healthy food
            const speed = (isHealthy ? 150 : (350 + Math.random() * 100)) * projectileSpeedMult.current * (isEasy ? 0.5 : 1); // Constant projectile speed
            
            projectiles.current.push({
              x: boss.current.x,
              y: boss.current.y,
              vx: Math.cos(spreadAngle) * speed,
              vy: Math.sin(spreadAngle) * speed,
              radius: 20,
              emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : (isBandAid ? '🩹' : JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)]),
              isPlayer: false,
              isHealthy: isHealthy,
              isBandAid: isBandAid,
              rotation: 0,
              rotationSpeed: (Math.random() - 0.5) * 8,
            });
          }
          boss.current.attackTimer = 1.0 + Math.random() * 0.5; // Constant frequency
        }
      }

      // State transitions based on corruption milestones
      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        if (boss.current.corruption >= 1000) {
          boss.current.state = 'ULTIMATE_SPAM';
          boss.current.slamTimer = 10;
          boss.current.attackTimer = 0;
          return;
        }

        const availableStates: (Boss['state'])[] = [];
        if (boss.current.corruption >= 100) availableStates.push('SLAMMING');
        if (boss.current.corruption >= 200) availableStates.push('OATMEAL_WALL');
        if (boss.current.corruption >= 300) availableStates.push('CHEF_SPIN');
        if (boss.current.corruption >= 400) availableStates.push('CHERRY_CHARGE');
        if (boss.current.corruption >= 500) availableStates.push('SUMMONING_DONGFISH');
        if (boss.current.corruption >= 800) availableStates.push('OREO_SANDWICH');
        
        if (modifiers.bigMode) {
          if (boss.current.corruption >= 600) availableStates.push('SMASH_2');
          if (boss.current.corruption >= 700 && !isOnMoon.current) availableStates.push('SODA_BLAST');
        }

        if (modifiers.hardMode) {
          if (boss.current.corruption >= 300) availableStates.push('EARTHQUAKE_CRACK');
        }
        
        if (modifiers.bWinger) {
          if (Math.random() < 0.4) availableStates.push('DIZZY');
          if (Math.random() < 0.3) availableStates.push('WHEELCHAIR');
        }

        if (modifiers.classicMode) {
          const hpPct = boss.current.health / boss.current.maxHealth;
          if (hpPct > 0.7) {
            if (boss.current.state !== 'NORMAL') boss.current.state = 'NORMAL';
          } else if (hpPct > 0.3) {
            if (!['SLAMMING', 'SUMMONING_DONGFISH', 'EARTHQUAKE_CRACK'].includes(boss.current.state)) {
              boss.current.state = ['SLAMMING', 'SUMMONING_DONGFISH', 'EARTHQUAKE_CRACK'][Math.floor(Math.random() * 3)] as Boss['state'];
            }
          } else {
            if (boss.current.state !== 'ULTIMATE_SPAM') boss.current.state = 'ULTIMATE_SPAM';
          }
        } else if (modifiers.aiMode) {
          if (performance.now() - lastAITick.current > 4000) {
            lastAITick.current = performance.now();
            fetchAIDecision();
          }
          if (aiDecision.current) {
            boss.current.state = aiDecision.current;
            aiDecision.current = '';
          } else if (availableStates.length > 0) {
            boss.current.state = availableStates[Math.floor(Math.random() * availableStates.length)];
          }
        } else if (availableStates.length > 0) {
          boss.current.state = availableStates[Math.floor(Math.random() * availableStates.length)];
        }

        if (boss.current.state === 'SUMMONING_DONGFISH') {
          boss.current.slamTimer = 5;
        } else if (boss.current.state === 'EARTHQUAKE_CRACK') {
            boss.current.slamTimer = 4;
            boss.current.attackTimer = 0;
            screenShake.current = 20;
          } else if (boss.current.state === 'OREO_SANDWICH') {
            boss.current.slamTimer = 4;
            boss.current.attackTimer = 0.5;
          } else if (boss.current.state === 'CHEF_SPIN') {
            boss.current.slamTimer = 4;
            boss.current.attackTimer = 0;
          } else if (boss.current.state === 'OATMEAL_WALL') {
            boss.current.slamTimer = 5;
            boss.current.attackTimer = 0.5;
          } else if (boss.current.state === 'CHERRY_CHARGE') {
            boss.current.slamTimer = 4;
            boss.current.attackTimer = 0;
          } else if (boss.current.state === 'DIZZY') {
            boss.current.slamTimer = 3;
            boss.current.attackTimer = 0;
          } else if (boss.current.state === 'WHEELCHAIR') {
            boss.current.slamTimer = 5;
            boss.current.attackTimer = 0;
          } else if (boss.current.state === 'SMASH_2') {
            boss.current.slamTimer = 6;
            boss.current.attackTimer = 0;
            screenShake.current = 20;
        } else if (boss.current.state === 'SODA_BLAST') {
          boss.current.slamTimer = 6;
          boss.current.attackTimer = 0;
        } else {
          boss.current.slamTimer = 5;
        }
      }
    } else if (boss.current.state === 'WHEELCHAIR') {
      boss.current.slamTimer -= dt;
      // Charge at player faster
      const angle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
      const speed = 800 + boss.current.corruption;
      boss.current.x += Math.cos(angle) * speed * dt;
      boss.current.y += Math.sin(angle) * speed * dt;
      
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 5;
      }
    } else if (boss.current.state === 'SMASH_2') {
      boss.current.slamTimer -= dt;
      // Earthquake effect
      screenShake.current = 15;
      
      // Spit out chicken fast
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        projectiles.current.push({
          x: boss.current.x,
          y: boss.current.y,
          vx: Math.cos(angle) * 800,
          vy: Math.sin(angle) * 800,
          radius: 20,
          emoji: '🍗',
          isPlayer: false,
          isHealthy: false,
          rotation: 0,
          rotationSpeed: 15,
        });
        boss.current.attackTimer = 0.05; // Very fast
      }
      
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 5;
        screenShake.current = 0;
      }
    } else if (boss.current.state === 'SODA_BLAST') {
      boss.current.slamTimer -= dt;
      // Aim at player
      const angle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
      boss.current.direction = angle;
      
      // Blast soda
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        projectiles.current.push({
          x: boss.current.x,
          y: boss.current.y,
          vx: Math.cos(angle) * 1500,
          vy: Math.sin(angle) * 1500,
          radius: 60,
          emoji: '🥤',
          isPlayer: false,
          isHealthy: false,
          isSodaBlast: true,
          rotation: 0,
          rotationSpeed: 20,
        });
        boss.current.attackTimer = 0.08;
      }

      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 5;
      }
    } else if (boss.current.state === 'EARTHQUAKE_CRACK') {
      // Crack logic
      boss.current.x += (Math.random() - 0.5) * 40;
      boss.current.y += (Math.random() - 0.5) * 40;
      screenShake.current = Math.max(screenShake.current, 25);

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        // Spawn crack projectiles from nearby relative floor
        for(let i=0; i<6; i++) {
          const crackX = boss.current.x + (Math.random() - 0.5) * 1600;
          const crackY = boss.current.y + (Math.random() - 0.5) * 1600;
          spawnParticles(crackX, crackY, '#7c2d12', 12);
          
          const isHealthy = modifiers.saladOnly;
          projectiles.current.push({
            x: crackX,
            y: crackY,
            vx: (Math.random() - 0.5) * 1000,
            vy: -400 - Math.random() * 1000,
            radius: 20,
            emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)],
            isPlayer: false,
            isHealthy: isHealthy,
            rotation: 0,
            rotationSpeed: Math.random() * 15
          });
        }
        boss.current.attackTimer = 0.15;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 4;
      }
    } else if (boss.current.state === 'DIZZY') {
      boss.current.slamTimer -= dt;
      // Boss spins slowly and does nothing
      boss.current.direction += 5 * dt; 
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'RAGE';
        boss.current.slamTimer = 6; // Rage for 6 seconds
        boss.current.attackTimer = 0;
      }
    } else if (boss.current.state === 'RAGE') {
      boss.current.slamTimer -= dt;
      // Spam Chef Boyardee (CHEF_SPIN)
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        // Spawn chef projectiles in a circle
        const numChefs = 8;
        for (let i = 0; i < numChefs; i++) {
          const angle = (i / numChefs) * Math.PI * 2 + boss.current.direction;
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(angle) * 400,
            vy: Math.sin(angle) * 400,
            radius: 30,
            emoji: '👨‍🍳',
            isPlayer: false,
            isHealthy: false,
            isChef: true,
            rotation: 0,
            rotationSpeed: 10,
          });
        }
        boss.current.attackTimer = 0.3;
        boss.current.direction += 0.5; // Rotate the spawn points
      }
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 5;
      }
    } else if (boss.current.state === 'CHERRY_CHARGE') {
      // Charge at player and leave soda trail
      const angle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
      const isEasy = modifiers.superEasy;
      const chargeSpeed = (600 + (boss.current.corruption / 2)) * (isEasy ? 0.5 : 1);
      boss.current.x += Math.cos(angle) * chargeSpeed * dt;
      boss.current.y += Math.sin(angle) * chargeSpeed * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0 && !modifiers.classicMode) {
        // Spawn soda trail
        const perpAngle = angle + Math.PI / 2;
        const offset = 40;
        const projSpeed = isEasy ? 50 : 100;
        
        // Cream Pepsi to the left
        projectiles.current.push({
          x: boss.current.x + Math.cos(perpAngle + Math.PI) * offset,
          y: boss.current.y + Math.sin(perpAngle + Math.PI) * offset,
          vx: Math.cos(perpAngle + Math.PI) * projSpeed,
          vy: Math.sin(perpAngle + Math.PI) * projSpeed,
          radius: 25,
          emoji: '🥤',
          isPlayer: false,
          isHealthy: false,
          isCreamPepsi: true,
          homingTimer: 1.5,
          rotation: 0,
          rotationSpeed: 5,
        });

        // Cherry Float to the right
        projectiles.current.push({
          x: boss.current.x + Math.cos(perpAngle) * offset,
          y: boss.current.y + Math.sin(perpAngle) * offset,
          vx: Math.cos(perpAngle) * projSpeed,
          vy: Math.sin(perpAngle) * projSpeed,
          radius: 25,
          emoji: '🍒',
          isPlayer: false,
          isHealthy: false,
          isCherryCoke: true,
          homingTimer: 1.5,
          rotation: 0,
          rotationSpeed: -5,
        });

        boss.current.attackTimer = 0.1;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 3;
      }
    } else if (boss.current.state === 'ULTIMATE_SPAM') {
      // THE FINAL FORM: Spam everything at once!
      // Boss spins and pulses
      const targetX = player.current.x;
      const targetY = player.current.y - 250;
      boss.current.x += (targetX - boss.current.x) * 3 * dt;
      boss.current.y += (targetY - boss.current.y) * 3 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        // 1. Base Projectile Spread (Insane amount)
        const angle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
        const numProjectiles = 15;
        const isEasy = modifiers.superEasy;
        const baseSpeed = isEasy ? 250 : 500;
        for (let i = 0; i < numProjectiles; i++) {
          const spreadOffset = (i - Math.floor(numProjectiles / 2)) * 0.15;
          const spreadAngle = angle + spreadOffset;
          const isHealthy = modifiers.saladOnly;
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(spreadAngle) * baseSpeed * projectileSpeedMult.current,
            vy: Math.sin(spreadAngle) * baseSpeed * projectileSpeedMult.current,
            radius: 20,
            emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)],
            isPlayer: false,
            isHealthy: isHealthy,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 10,
          });
        }

        // 2. Chef Boyardee Cans
        const numCans = 4;
        const canSpeed = isEasy ? 300 : 600;
        for (let i = 0; i < numCans; i++) {
          const canAngle = (performance.now() / 50) + (i * (Math.PI * 2 / numCans));
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(canAngle) * canSpeed * projectileSpeedMult.current,
            vy: Math.sin(canAngle) * canSpeed * projectileSpeedMult.current,
            radius: 25,
            emoji: '🥫',
            isPlayer: false,
            isHealthy: false,
            isChef: true,
            rotation: 0,
            rotationSpeed: 15,
          });
        }

        // 3. Occasional Oatmeal Wall
        if (Math.random() < 0.3) {
          const wallX = player.current.x + (Math.random() > 0.5 ? 300 : -300);
          const startY = player.current.y - 200;
          for (let i = 0; i < 5; i++) {
            projectiles.current.push({
              x: wallX,
              y: startY + (i * 100),
              vx: 0,
              vy: 0,
              radius: 40,
              emoji: '🍪',
              isPlayer: false,
              isHealthy: false,
              isOatmeal: true,
              life: 1.0,
              rotation: 0,
              rotationSpeed: 0,
            });
          }
        }

        // 4. Dongfish
        if (Math.random() < 0.2) {
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: 0,
            vy: 0,
            radius: 25,
            emoji: '🐟',
            isPlayer: false,
            isHealthy: false,
            isDongfish: true,
            life: 5,
            rotation: 0,
            rotationSpeed: 0,
          });
        }

        // 5. Oreo Halves
        if (Math.random() < 0.1) {
          projectiles.current.push({
            x: cameraX - 50,
            y: player.current.y,
            vx: 800 * projectileSpeedMult.current,
            vy: 0,
            radius: 60,
            emoji: '🍪',
            isPlayer: false,
            isHealthy: false,
            isOreo: true,
            rotation: 0,
            rotationSpeed: 8,
          });
          projectiles.current.push({
            x: cameraX + CANVAS_WIDTH + 50,
            y: player.current.y,
            vx: -800 * projectileSpeedMult.current,
            vy: 0,
            radius: 60,
            emoji: '🍪',
            isPlayer: false,
            isHealthy: false,
            isOreo: true,
            rotation: 0,
            rotationSpeed: -8,
          });
        }

        boss.current.attackTimer = 0.4;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        // Stay in ultimate spam if still at 1000%
        if (boss.current.corruption < 1000) {
          boss.current.state = 'NORMAL';
          boss.current.slamTimer = 2;
        } else {
          boss.current.slamTimer = 10;
        }
      }
    } else if (boss.current.state === 'OATMEAL_WALL') {
      // Boss moves to a position to watch the wall
      const targetX = cameraX + CANVAS_WIDTH / 2;
      const targetY = cameraY + 100;
      boss.current.x += (targetX - boss.current.x) * 2 * dt;
      boss.current.y += (targetY - boss.current.y) * 2 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0 && boss.current.slamTimer > 3) {
        // Spawn the wall of oatmeal cream pies
        const wallX = player.current.x + 300;
        const startY = player.current.y - 250;
        const numPies = 6 + Math.floor(corruptionFactor * 4);
        
        for (let i = 0; i < numPies; i++) {
          projectiles.current.push({
            x: wallX,
            y: startY + (i * 100),
            vx: 0,
            vy: 0,
            radius: 40,
            emoji: '🍪',
            isPlayer: false,
            isHealthy: false,
            isOatmeal: true,
            life: 1.5, // Time before flinging
            rotation: 0,
            rotationSpeed: 0,
          });
        }
        boss.current.attackTimer = 999; // Only spawn once
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 2 + Math.random() * 2;
      }
    } else if (boss.current.state === 'CHEF_SPIN') {
      // Boss spins fast and spits out Chef Boyardee
      const targetX = player.current.x;
      const targetY = player.current.y - 200;
      boss.current.x += (targetX - boss.current.x) * 1.5 * dt;
      boss.current.y += (targetY - boss.current.y) * 1.5 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        const numCans = 2 + Math.floor(corruptionFactor * 3);
        for (let i = 0; i < numCans; i++) {
          const angle = (performance.now() / 100) + (i * (Math.PI * 2 / numCans));
          const speed = 450;
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 25,
            emoji: '🥫',
            isPlayer: false,
            isHealthy: false,
            isChef: true,
            rotation: 0,
            rotationSpeed: 10,
          });
        }
        boss.current.attackTimer = 0.2;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 2 + Math.random() * 2;
      }
    } else if (boss.current.state === 'OREO_SANDWICH') {
      // Boss moves to center of screen
      const targetX = cameraX + CANVAS_WIDTH / 2;
      const targetY = cameraY + 150;
      boss.current.x += (targetX - boss.current.x) * 2 * dt;
      boss.current.y += (targetY - boss.current.y) * 2 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0 && boss.current.slamTimer > 1) {
        // Spawn the two halves
        const spawnX1 = cameraX - 100;
        const spawnX2 = cameraX + CANVAS_WIDTH + 100;
        const spawnY = player.current.y;

        projectiles.current.push({
          x: spawnX1,
          y: spawnY,
          vx: 600,
          vy: 0,
          radius: 80,
          emoji: '🍪',
          isPlayer: false,
          isHealthy: false,
          isOreo: true,
          rotation: 0,
          rotationSpeed: 5,
        });

        projectiles.current.push({
          x: spawnX2,
          y: spawnY,
          vx: -600,
          vy: 0,
          radius: 80,
          emoji: '🍪',
          isPlayer: false,
          isHealthy: false,
          isOreo: true,
          rotation: 0,
          rotationSpeed: -5,
        });

        boss.current.attackTimer = 999; // Only spawn once per state
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 3 + Math.random() * 2;
      }
    } else if (boss.current.state === 'SUMMONING_DONGFISH') {
      boss.current.x += boss.current.speed * boss.current.direction * dt;
      boss.current.y = cameraY + 120 + Math.sin(performance.now() / 500) * 30;

      if (boss.current.x < cameraX + boss.current.width / 2 + 50 || boss.current.x > cameraX + CANVAS_WIDTH - boss.current.width / 2 - 50) {
        boss.current.direction *= -1;
        boss.current.x = Math.max(cameraX + boss.current.width / 2 + 50, Math.min(cameraX + CANVAS_WIDTH - boss.current.width / 2 - 50, boss.current.x));
      }

      // Summon dongfish
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        projectiles.current.push({
          x: boss.current.x,
          y: boss.current.y,
          vx: 0,
          vy: 0,
          radius: 25,
          emoji: '🐟',
          isPlayer: false,
          isHealthy: false,
          isDongfish: true,
          life: 10,
          rotation: 0,
          rotationSpeed: 0,
        });
        boss.current.attackTimer = 0.8; // Constant summoning speed
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 3 + Math.random() * 2;
      }
    } else if (boss.current.state === 'SLAMMING') {
      boss.current.y += 1000 * dt; // Fast fall
      const floorY = cameraY + CANVAS_HEIGHT - boss.current.height / 2;
      if (boss.current.y >= floorY) {
        boss.current.y = floorY;
        boss.current.state = 'RISING';
        boss.current.slamTimer = 3 + Math.random() * 2;
        
        // Slam impact - spawn junk food explosion
        const numSlamProjectiles = 24 + Math.floor(corruptionFactor * 48);
        for (let i = 0; i < numSlamProjectiles; i++) {
          const isHealthy = modifiers.saladOnly;
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: (Math.random() - 0.5) * 1000,
            vy: -200 - Math.random() * 800,
            radius: 20,
            emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)],
            isPlayer: false,
            isHealthy: isHealthy,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 15,
          });
        }
      }
    } else if (boss.current.state === 'RISING') {
      boss.current.y -= 250 * dt; // Slower rise
      const targetY = cameraY + 120;
      if (boss.current.y <= targetY) {
        boss.current.y = targetY;
        boss.current.state = 'NORMAL';
      }
    }

    // Player-Boss collision (hitbox)
    const bdx = player.current.x - boss.current.x;
    const bdy = player.current.y - boss.current.y;
    const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
    if (bdist < (player.current.width / 2 + boss.current.width / 2.5)) {
      if (!godMode.current && !modifiers.godMode) {
        const damage = (modifiers.superEasy ? 10 : 40);
        player.current.health -= damage * dt; // Continuous damage if touching
        player.current.isHit = 0.1;
        if (player.current.health <= 0) {
          stopGame('GAME_OVER');
        }
      }
    }

    // Boss health regen
    if (boss.current.health > 0 && boss.current.health < boss.current.maxHealth) {
      boss.current.health = Math.min(boss.current.maxHealth, boss.current.health + boss.current.regenRate * dt);
    }
    
    // Player health regen
    if (player.current.health > 0 && player.current.health < player.current.maxHealth && !godMode.current && !modifiers.godMode) {
      const upgRegen = profile?.upgrades?.healthRegen || 0;
      if (upgRegen > 0) {
        player.current.health = Math.min(player.current.maxHealth, player.current.health + (upgRegen * dt));
      }
    }

    // Black Hole Core Pull
    if (modifiers.blackHoleCore) {
      const centerX = WORLD_WIDTH / 2;
      const centerY = WORLD_HEIGHT / 2;
      
      // Pull player
      const pDx = centerX - player.current.x;
      const pDy = centerY - player.current.y;
      const pDist = Math.max(10, Math.sqrt(pDx * pDx + pDy * pDy));
      
      // Distance-based pull: gets linearly stronger as you approach center
      // Max pull is 320 (less than base player speed of 350) to allow escape
      const maxPPull = 320;
      const pullRange = 1800;
      const pPullForce = Math.max(0, (1 - pDist / pullRange) * maxPPull);
      
      player.current.x += (pDx / pDist) * pPullForce * dt;
      player.current.y += (pDy / pDist) * pPullForce * dt;

      // Pull boss
      const bDx = centerX - boss.current.x;
      const bDy = centerY - boss.current.y;
      const bDist = Math.max(10, Math.sqrt(bDx * bDx + bDy * bDy));
      const bPullForce = Math.max(0, (1 - bDist / pullRange) * 200);
      boss.current.x += (bDx / bDist) * bPullForce * dt;
      boss.current.y += (bDy / bDist) * bPullForce * dt;
    }

    // Update projectiles
    for (let i = projectiles.current.length - 1; i >= 0; i--) {
      const p = projectiles.current[i];
      
      // Black Hole Pull on projectiles
      if (modifiers.blackHoleCore) {
        const centerX = WORLD_WIDTH / 2;
        const centerY = WORLD_HEIGHT / 2;
        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.max(10, Math.sqrt(dx * dx + dy * dy));
        
        const projPullRange = 1500;
        const projMaxPull = 1200;
        const projPull = Math.max(0, (1 - dist / projPullRange) * projMaxPull);
        
        p.vx += (dx / dist) * projPull * dt;
        p.vy += (dy / dist) * projPull * dt;
      }

      if (p.isOatmeal && p.life !== undefined) {
        p.life -= dt;
        if (p.life <= 0 && p.vx === 0) {
          // Fling toward player
          const angle = Math.atan2(player.current.y - p.y, player.current.x - p.x);
          const speed = (modifiers.superEasy ? 350 : 700);
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.rotationSpeed = 10;
        }
      }

      if (p.isDongfish && p.life !== undefined) {
        p.life -= dt;
        if (p.life <= 0) {
          // Walk off screen
          p.vx = 200; // Move right
          p.vy = 0;
          p.rotation = 0;
        } else {
          // Chase player
          const angle = Math.atan2(player.current.y - p.y, player.current.x - p.x);
          const speed = 200; // Constant speed
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.rotation = angle;
        }
      }

      if ((p.isCherryCoke || p.isCreamPepsi) && p.homingTimer !== undefined) {
        p.homingTimer -= dt;
        if (p.homingTimer <= 0) {
          // Charge at player
          const angle = Math.atan2(player.current.y - p.y, player.current.x - p.x);
          const speed = (modifiers.superEasy ? 600 : 1200);
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.homingTimer = 999; // Only trigger once
          p.rotationSpeed = 20;
        }
      }

      if (Math.abs(p.vx) > 3000) p.vx = Math.sign(p.vx) * 3000;
      if (Math.abs(p.vy) > 3000) p.vy = Math.sign(p.vy) * 3000;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Dimension Tear Teleportation
      if (modifiers.dimensionTear) {
        if (!p.lastTeleport || performance.now() - p.lastTeleport > 500) {
          dimensionTears.current.forEach(tear => {
            const dx = p.x - tear.x;
            const dy = p.y - tear.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < tear.radius / 2) {
              const partner = dimensionTears.current[tear.partnerIndex];
              p.x = partner.x;
              p.y = partner.y;
              p.lastTeleport = performance.now();
              // Add some randomness to velocity to make it interesting
              const angle = Math.atan2(p.vy, p.vx) + (Math.random() - 0.5) * 0.5;
              const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
              p.vx = Math.cos(angle) * speed;
              p.vy = Math.sin(angle) * speed;
            }
          });
        }
      }

      // Wall collision for projectile
      if (modifiers.enhancedMap) {
        let hitWall = false;
        walls.current.forEach(w => {
          if (p.x > w.x && p.x < w.x + w.width && p.y > w.y && p.y < w.y + w.height) {
            hitWall = true;
          }
        });
        if (hitWall) {
          spawnParticles(p.x, p.y, '#64748b', 5);
          projectiles.current.splice(i, 1);
          continue;
        }
      }

      if (!p.isDongfish) {
        p.rotation += p.rotationSpeed * dt;
      }

      // Remove off-screen
      if (p.x < -50 || p.x > WORLD_WIDTH + 50 || p.y < -50 || p.y > WORLD_HEIGHT + 50) {
        projectiles.current.splice(i, 1);
        continue;
      }

      // Collision detection
      if (p.isPlayer) {
        // Hit boss?
        const dx = p.x - boss.current.x;
        const dy = p.y - boss.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < boss.current.width / 2 + p.radius) {
          let damage = 150;
          if (modifiers.nutritionBalanceMode && Math.abs(balanceLevel.current) < 20) {
            damage *= 2; // Perfect balance doubles damage!
          }
          boss.current.health -= damage; // More damage since ammo is limited
          boss.current.isHit = 0.1; // Flash timer
          
          if (modifiers.nutritionBalanceMode) {
            if (p.isHealthy) balanceLevel.current = Math.min(100, balanceLevel.current + 12);
            else balanceLevel.current = Math.max(-100, balanceLevel.current - 12);
          }
          
          // I-Ready Test increases as boss takes damage
          const gain = 25;
          const maxCorruption = modifiers.accurateMode ? 750 : 1000;
          boss.current.corruption = Math.min(maxCorruption, boss.current.corruption + gain);
          boss.current.regenRate = 15 + (boss.current.corruption / 5); // Regen scales with I-Ready Test score
          
          spawnParticles(p.x, p.y, '#4ade80', 15);
          projectiles.current.splice(i, 1);
          
          if (boss.current.health <= 0) {
            stopGame('VICTORY');
          }
          continue;
        }
      } else {
        // Hit player?
        const dx = p.x - player.current.x;
        const dy = p.y - player.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < player.current.width / 2 + p.radius - 10) { // Slightly forgiving hitbox for player
          if (p.isHealthy) {
            // Deflect healthy food!
            if (modifiers.accurateMode) {
              deflectedSalads.current++;
              if (deflectedSalads.current === 10 && !hasTriggeredSaladDialogue.current) {
                hasTriggeredSaladDialogue.current = true;
                setDialogueMode('SALAD_DISGUSTING');
                setDialogueIndex(0);
                setGameState('DIALOGUE');
              }
            }
            p.isPlayer = true;
            const angle = Math.atan2(boss.current.y - p.y, boss.current.x - p.x);
            const speed = 800;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            spawnParticles(p.x, p.y, '#4ade80', 5);

            if (modifiers.nutritionBalanceMode) {
              balanceLevel.current = Math.min(100, balanceLevel.current + 10);
            }
          } else if (p.isBandAid) {
            // Heal from band-aid!
            player.current.health = Math.min(player.current.maxHealth, player.current.health + 25);
            spawnParticles(p.x, p.y, '#ffffff', 15);
            projectiles.current.splice(i, 1);
          } else if (p.isSodaBlast) {
            isOnMoon.current = true;
            screenShake.current = 50;
            // Reset positions for moon fight
            player.current.x = WORLD_WIDTH / 2;
            player.current.y = WORLD_HEIGHT / 2;
            boss.current.x = WORLD_WIDTH / 2;
            boss.current.y = WORLD_HEIGHT / 2 - 400;
            boss.current.state = 'NORMAL';
            boss.current.slamTimer = 5;
            projectiles.current = [];
            cinematicTimer.current = 0; // Reset for transition text
            spawnParticles(p.x, p.y, '#ffffff', 50);
            break; // Stop processing projectiles after clearing the array
          } else {
            // Take damage from junk food
            if (!godMode.current && !modifiers.godMode) {
              const damage = p.isOreo ? 35 : (p.isChef ? 20 : (p.isOatmeal ? 25 : (p.isMonkBullet ? 18 : 15)));
              let finalDamage = damage;
              if (modifiers.hardMode) finalDamage *= 2.0;

              player.current.health -= finalDamage;
              player.current.isHit = 0.2;
              spawnParticles(p.x, p.y, p.isOreo ? '#334155' : (p.isChef ? '#ef4444' : (p.isOatmeal ? '#78350f' : (p.isMonkBullet ? '#fbbf24' : '#f87171'))), 12);
              
              if (modifiers.nutritionBalanceMode) {
                if (p.isHealthy) balanceLevel.current = Math.min(100, balanceLevel.current + 10);
                else balanceLevel.current = Math.max(-100, balanceLevel.current - 10);
              }

              if (modifiers.hardMode && Math.random() < 0.25) {
                player.current.stunTimer = 1.0;
                spawnParticles(player.current.x, player.current.y, '#fef08a', 20);
              }

              if (player.current.health <= 0) {
                stopGame('GAME_OVER');
              }
            }
            projectiles.current.splice(i, 1);
          }
          continue;
        }
      }
    }

    // Update particles
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        particles.current.splice(i, 1);
      }
    }

    // Hit flash timers
    if (player.current.isHit > 0) player.current.isHit -= dt;
    if (boss.current.isHit > 0) boss.current.isHit -= dt;

    if (infiniteHealth.current) {
      player.current.health = player.current.maxHealth;
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    // Calculate camera position
    const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = dimensionsRef.current;
    const cameraX = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, player.current.x - CANVAS_WIDTH / 2));
    const cameraY = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, player.current.y - CANVAS_HEIGHT / 2));

    // Clear background
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    // Apply camera zoom
    if (modifiers.bigMode) {
      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.scale(cameraZoom.current, cameraZoom.current);
      ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);
    }

    if (screenShake.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake.current;
      const shakeY = (Math.random() - 0.5) * screenShake.current;
      ctx.translate(shakeX, shakeY);
    }
    ctx.translate(-cameraX, -cameraY);

    if (isOnMoon.current) {
      if (moonImage.complete) {
        ctx.drawImage(moonImage, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      }
    } else if (boss.current.state === 'SMASH_2') {
      ctx.fillStyle = '#7c2d12'; // orange-900 (lava feel)
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }

    // Draw grid for arena feel
    ctx.strokeStyle = isOnMoon.current ? '#475569' : '#1e293b'; // slate-800
    ctx.lineWidth = 2;
    for (let i = 0; i <= WORLD_WIDTH; i += 80) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i <= WORLD_HEIGHT; i += 80) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(WORLD_WIDTH, i);
      ctx.stroke();
    }

    // Draw Black Hole
    if (modifiers.blackHoleCore) {
      ctx.save();
      const centerX = WORLD_WIDTH / 2;
      const centerY = WORLD_HEIGHT / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate(performance.now() / 1000);
      
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 300);
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(0.3, '#000000');
      gradient.addColorStop(0.5, '#4c1d95');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 300, 0, Math.PI * 2);
      ctx.fill();

      if (blackHoleImage.complete) {
        ctx.globalAlpha = 0.6;
        ctx.drawImage(blackHoleImage, -150, -150, 300, 300);
      }
      ctx.restore();
    }

    // Draw Dimension Tears
    if (modifiers.dimensionTear) {
      dimensionTears.current.forEach(tear => {
        ctx.save();
        ctx.translate(tear.x, tear.y);
        ctx.rotate(performance.now() / 500);
        
        if (dimensionTearImage.complete) {
          ctx.drawImage(dimensionTearImage, -tear.radius / 2, -tear.radius / 2, tear.radius, tear.radius);
        } else {
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, tear.radius / 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#8b5cf6';
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 2;
        ctx.strokeRect(-tear.radius / 4, -tear.radius / 4, tear.radius / 2, tear.radius / 2);
        
        ctx.restore();
      });
    }

    // Draw world bounds
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Draw walls
    if (modifiers.enhancedMap) {
      walls.current.forEach(w => {
        ctx.fillStyle = w.color;
        ctx.fillRect(w.x, w.y, w.width, w.height);
        
        // Highlight effect
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 4;
        ctx.strokeRect(w.x, w.y, w.width, w.height);

        // Pattern on walls
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        for(let i=20; i<w.width; i+=40) {
           ctx.beginPath();
           ctx.moveTo(w.x + i, w.y);
           ctx.lineTo(w.x + i, w.y + w.height);
           ctx.stroke();
        }
      });
    }

    if (modifiers.hardMode) {
      // Dark pulsating background for hard mode
      const intensity = 0.1 + Math.sin(performance.now() / 300) * 0.05;
      ctx.fillStyle = `rgba(12, 10, 9, ${intensity})`;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Glitch lines
      if (Math.random() < 0.05) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(0, Math.random() * WORLD_HEIGHT, WORLD_WIDTH, 20);
      }

      // "SUFFER" overlay
      if (Math.floor(cinematicTimer.current % 12) < 1.5) {
        ctx.save();
        ctx.font = 'bold 120px Impact';
        ctx.fillStyle = 'rgba(239,68,68,0.3)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SUFFER!', cameraX + CANVAS_WIDTH / 2, cameraY + CANVAS_HEIGHT / 2);
        ctx.restore();
      }
    }
    
    // Draw Boss (Gorgotolisis)
    ctx.save();
    ctx.translate(boss.current.x, boss.current.y);
    
    // Boss scale pulsing based on health regen
    const pulse = 1 + Math.sin(performance.now() / 200) * 0.05;
    ctx.scale(pulse, pulse);

    // Spin effect for Chef Spin or Ultimate Spam attack
    if (boss.current.state === 'CHEF_SPIN' || boss.current.state === 'ULTIMATE_SPAM') {
      ctx.rotate(performance.now() / (boss.current.state === 'ULTIMATE_SPAM' ? 20 : 50));
    }

    if (modifiers.monkCartmanMode) {
      // Periodic helicopter tilt
      const tilt = Math.sin(performance.now() / 400) * 0.1;
      ctx.rotate(tilt);
    }

    if (boss.current.isHit > 0) {
      ctx.filter = 'brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)';
    }

    if (boss.current.state === 'DIZZY') {
      ctx.rotate(boss.current.direction);
      // Draw stars around dizzy boss
      for (let i = 0; i < 5; i++) {
        const starAngle = (i / 5) * Math.PI * 2 + performance.now() / 200;
        ctx.fillText('💫', Math.cos(starAngle) * 80, Math.sin(starAngle) * 80);
      }
    }

    if (boss.current.state === 'RAGE' || boss.current.state === 'SODA_BLAST') {
      ctx.filter = 'contrast(2) brightness(1.2) hue-rotate(-30deg)';
      ctx.scale(1.2, 1.2); // Slightly bigger in rage/blast
    }
    
    if (boss.current.state === 'SODA_BLAST') {
      ctx.save();
      ctx.rotate(boss.current.direction);
      const gradient = ctx.createLinearGradient(0, 0, 2000, 0);
      gradient.addColorStop(0, 'rgba(244, 63, 94, 0.8)');
      gradient.addColorStop(1, 'rgba(244, 63, 94, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, -40, 2000, 80);
      ctx.restore();
    }
    
    let img = activeBossImage.current;
    if (boss.current.state === 'WHEELCHAIR') {
      img = wheelchairImage;
    }

    if (img.complete) {
      ctx.drawImage(img, -boss.current.width / 2, -boss.current.height / 2, boss.current.width, boss.current.height);
    } else {
      ctx.font = `${boss.current.width * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👹', 0, 0);
    }
    ctx.restore();

    // Draw Projectiles
    projectiles.current.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      
      // Add a subtle glow
      if (p.isPlayer || p.isHealthy) {
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 15;
      } else if (p.isCherryCoke || p.isCreamPepsi) {
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 20;
      } else {
        ctx.shadowColor = '#f87171';
        ctx.shadowBlur = 10;
      }
      
      let img = junkFoodImage;
      if (p.isDongfish) img = dongfishImage;
      else if (p.isOreo) img = oreoImage;
      else if (p.isChef) img = chefImage;
      else if (p.isOatmeal) img = oatmealImage;
      else if (p.isCherryCoke) img = cherryCokeImage;
      else if (p.isCreamPepsi) img = creamPepsiImage;
      else if (p.isHealthy) img = healthyFoodImage;

      const isMonkBullet = !!p.isMonkBullet;

      if (!p.isBandAid && !isMonkBullet && img.complete && img.naturalWidth > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.clip();
        // Draw image slightly larger to fill the circle
        ctx.drawImage(img, -p.radius * 1.2, -p.radius * 1.2, p.radius * 2.4, p.radius * 2.4);
      } else if (isMonkBullet) {
        // Draw Tracer Bullet
        ctx.fillStyle = '#fcd34d'; // amber-300
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 2, p.radius / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#f59e0b';
      } else {
        ctx.font = `${p.radius * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
      }
      ctx.restore();
    });

    // Draw Particles
    particles.current.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Storm
    if (modifiers.storm) {
      ctx.save();
      ctx.strokeStyle = '#a855f7'; // purple-500
      ctx.lineWidth = 10;
      ctx.setLineDash([20, 10]);
      ctx.beginPath();
      ctx.arc(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, stormRadius.current, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw outer darkness
      ctx.beginPath();
      ctx.arc(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, stormRadius.current, 0, Math.PI * 2);
      ctx.rect(WORLD_WIDTH, 0, -WORLD_WIDTH, WORLD_HEIGHT);
      ctx.fillStyle = 'rgba(88, 28, 135, 0.3)'; // purple-900 with alpha
      ctx.fill();
      ctx.restore();
    }

    // Draw Helicopter
    if (helicopter.current.active) {
      const h = helicopter.current;
      ctx.save();
      ctx.translate(h.x, h.y);
      // Subtle tilt based on movement
      const tilt = (Math.sin(performance.now() / 200) * 0.05);
      ctx.rotate(tilt);
      
      if (helicopterImage.complete) {
        ctx.drawImage(helicopterImage, -h.width / 2, -h.height / 2, h.width, h.height);
      }
      
      // Draw Cartman in the chopper
      if (cartmanImage.complete) {
        ctx.drawImage(cartmanImage, -30, -20, 60, 60);
      }

      // Draw prompt if player is not in
      if (!h.hasPlayer && gameState === 'PLAYING') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GET IN!', 0, -h.height / 2 - 10);
      }

      ctx.restore();
    }

    ctx.restore(); // Restore camera translation

    // Moon transition text
    if (isOnMoon.current && cinematicTimer.current < 3) {
      ctx.save();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 80px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'cyan';
      ctx.shadowBlur = 20;
      ctx.fillText('MOON BATTLE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.font = 'bold 30px Arial';
      ctx.fillText('LOW GRAVITY ENGAGED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
      ctx.restore();
    }

    // Chaos Mode display
    if (modifiers.randomChaos && cinematicTimer.current < 5) {
      ctx.save();
      ctx.fillStyle = '#fde047'; // yellow-300
      ctx.font = 'black 60px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 15;
      ctx.fillText('RANDOM CHAOS!', CANVAS_WIDTH / 2, 180);
      
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#ffffff';
      activeModifiers.forEach((mod, idx) => {
        ctx.fillText(`⚡ ${mod}`, CANVAS_WIDTH / 2, 230 + idx * 35);
      });
      ctx.restore();
    }

    // --- UI Layer (Fixed to screen) ---
    
    // Corruption Meter
    if (!modifiers.classicMode) {
      const corruptionPct = boss.current.corruption / 1000;
      const meterWidth = 300;
      const meterX = CANVAS_WIDTH - meterWidth - 20;
      const meterY = 80;

      ctx.fillStyle = '#1e1b4b'; // dark indigo
      ctx.fillRect(meterX, meterY, meterWidth, 12);
      
      // Color shifts as score increases
      const r = Math.min(255, 100 + corruptionPct * 400);
      const g = Math.max(0, 50 - corruptionPct * 100);
      const b = Math.max(0, 255 - corruptionPct * 300);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      
      ctx.fillRect(meterX, meterY, meterWidth * corruptionPct, 12);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(meterX, meterY, meterWidth, 12);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`I-READY TEST: ${Math.floor(boss.current.corruption)}%`, meterX + meterWidth, meterY - 5);
    }

    // Draw Boss Health Bar
    const bossHpPct = Math.max(0, boss.current.health / boss.current.maxHealth);
    const barWidth = 500;
    const barX = (CANVAS_WIDTH - barWidth) / 2;
    
    // Background
    ctx.fillStyle = '#7f1d1d'; // red-900
    ctx.fillRect(barX, 30, barWidth, 24);
    // Fill
    ctx.fillStyle = '#ef4444'; // red-500
    ctx.fillRect(barX, 30, barWidth * bossHpPct, 24);
    // Border
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 3;
    ctx.strokeRect(barX, 30, barWidth, 24);
    
    // Boss Name & Status
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    const bossName = modifiers.monkCartmanMode ? 'MONK CARTMAN' : 'GORGOTOLISIS';
    ctx.fillText(`${bossName} - (Regenerating +${Math.floor(boss.current.regenRate)} HP/s)`, CANVAS_WIDTH / 2, 20);
    ctx.shadowBlur = 0;

    // Draw Player
    ctx.save();
    // Player is drawn in UI layer (fixed to screen) relative to camera
    const playerScreenX = player.current.x - cameraX;
    const playerScreenY = player.current.y - cameraY;

    if (player.current.stunTimer > 0) {
      // Draw stun effect
      ctx.save();
      ctx.translate(playerScreenX, playerScreenY - 40);
      const stunRot = performance.now() / 100;
      ctx.rotate(stunRot);
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫', 0, 0);
      ctx.restore();
    }

    ctx.translate(playerScreenX, playerScreenY);
    if (player.current.isHit > 0) {
      ctx.filter = 'brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)';
    }

    const activeSkin = SHOP_SKINS.find(s => s.id === currentSkin.current) || SHOP_SKINS[0];

    if (activeSkin.type === 'image') {
      const img = skinImages[activeSkin.id];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -player.current.width / 2, -player.current.height / 2, player.current.width, player.current.height);
      } else {
        // Fallback or loading state
        ctx.font = `${player.current.width}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⏳', 0, 0);
      }
    } else {
      ctx.font = `${player.current.width}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(activeSkin.value, 0, 0);
    }
    
    ctx.restore();

    // Draw Player Health
    const playerHpPct = Math.max(0, player.current.health / player.current.maxHealth);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(20, CANVAS_HEIGHT - 40, 200, 20);
    ctx.fillStyle = '#22c55e'; // green-500
    ctx.fillRect(20, CANVAS_HEIGHT - 40, 200 * playerHpPct, 20);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, CANVAS_HEIGHT - 40, 200, 20);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(`HEALTH`, 20, CANVAS_HEIGHT - 48);
    ctx.shadowBlur = 0;

    // Add Nutrition Balance Meter
    if (modifiers.nutritionBalanceMode) {
      const bMeterW = 300;
      const bMeterH = 20;
      const bMeterX = (CANVAS_WIDTH - bMeterW) / 2;
      const bMeterY = CANVAS_HEIGHT - 100;

      // Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(bMeterX, bMeterY, bMeterW, bMeterH);
      
      // Regions
      // Danger left (red)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.fillRect(bMeterX, bMeterY, bMeterW * 0.2, bMeterH);
      // Balanced center (green)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
      ctx.fillRect(bMeterX + bMeterW * 0.4, bMeterY, bMeterW * 0.2, bMeterH);
      // Danger right (green but too healthy?)
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fillRect(bMeterX + bMeterW * 0.8, bMeterY, bMeterW * 0.2, bMeterH);

      // Indicator
      const indicatorPos = bMeterX + (bMeterW / 2) + (balanceLevel.current / 100) * (bMeterW / 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
      ctx.fillRect(indicatorPos - 2, bMeterY - 5, 4, bMeterH + 10);
      ctx.shadowBlur = 0;

      // Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      const balanceStatus = Math.abs(balanceLevel.current) < 20 ? 'PERFECTLY BALANCED (2X DAMAGE!)' : 
                           (Math.abs(balanceLevel.current) > 80 ? 'MALNOURISHED (TAKING DAMAGE!)' : 'UNBALANCED');
      ctx.fillText(`NUTRITION BALANCE: ${balanceStatus}`, bMeterX + bMeterW / 2, bMeterY - 15);
      
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('JUNK', bMeterX, bMeterY + bMeterH + 12);
      ctx.textAlign = 'right';
      ctx.fillText('HEALTHY', bMeterX + bMeterW, bMeterY + bMeterH + 12);
    }

    // God Mode Indicator
    if (godMode.current || modifiers.godMode) {
      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('GOD MODE ACTIVE', 20, CANVAS_HEIGHT - 70);
    }
  };

  const loop = (time: number) => {
    if (!lastTime.current) lastTime.current = time;
    const dt = (time - lastTime.current) / 1000;
    lastTime.current = time;

    update(dt);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx);
    }

    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      const key = e.key.toLowerCase();
      keys.current[key] = true; 
      
      // Cheat code detection
      cheatBuffer.current += key;
      if (cheatBuffer.current.endsWith('gorg')) {
        godMode.current = !godMode.current;
        setIsGodModeActive(godMode.current);
        cheatBuffer.current = '';
        if (!godMode.current) setShowAdminPanel(false);
        // Visual feedback for cheat
        spawnParticles(player.current.x, player.current.y, '#fbbf24', 30);
      }
      if (cheatBuffer.current.length > 10) {
        cheatBuffer.current = cheatBuffer.current.slice(-10);
      }

      if (e.key === 'Escape' && gameState === 'PLAYING') {
        setIsPaused(prev => !prev);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  useEffect(() => {
    // Resize Observer for full screen
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        dimensionsRef.current = { width, height };
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mousePos.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden font-sans selection:bg-transparent">
      
      {/* Hidden music iframe */}
      {musicPlaying && (
        <div className="fixed bottom-0 right-0 w-[1px] h-[1px] opacity-0 overflow-hidden z-[100]">
          <iframe 
            src="https://streamable.com/e/etj1p8?autoplay=1&muted=0&loop=1" 
            width="100%" 
            height="100%" 
            frameBorder="0" 
            allow="autoplay" 
            allowFullScreen
            title="music"
          />
        </div>
      )}

      <div ref={containerRef} className="absolute inset-0 w-full h-full bg-slate-900">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="block w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseDown={() => { isMouseDown.current = true; }}
          onMouseUp={() => { isMouseDown.current = false; }}
          onMouseLeave={() => { isMouseDown.current = false; }}
          onContextMenu={(e) => e.preventDefault()}
        />
        
        {/* UI Overlays */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white p-8 text-center backdrop-blur-sm">
            <div className="text-8xl mb-6 drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]">👹</div>
            <h2 className="text-5xl font-black mb-4 text-white drop-shadow-lg">
              {modifiers.monkCartmanMode ? 'CONFRONT MONK CARTMAN' : 'DEFEAT GORGOTOLISIS'}
            </h2>
            
            {!user ? (
              <div className="mb-8 p-6 bg-slate-900/60 rounded-2xl border border-slate-700">
                <p className="mb-4 text-slate-300">Sign in to save your progress and high scores!</p>
                <button 
                  onClick={handleLogin}
                  className="px-8 py-3 bg-white text-slate-950 font-black rounded-full hover:bg-slate-200 transition-all flex items-center gap-3"
                >
                  <img src="https://www.gstatic.com/firebase/anonymous-scan.png" className="w-6 h-6 hidden" alt="" />
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </button>
              </div>
            ) : (
              <div className="mb-8 flex items-center gap-4 p-4 bg-slate-900/40 rounded-2xl border border-slate-800">
                <img src={user.photoURL || ''} className="w-12 h-12 rounded-full border-2 border-green-500" alt="" />
                <div className="text-left">
                  <div className="text-sm text-slate-400">Logged in as</div>
                  <div className="font-bold text-green-400">{user.displayName}</div>
                  <div className="text-xs text-slate-500">Best: {profile?.highScore || 0} pts</div>
                </div>
                
                {profile?.isVip ? (
                  <div className="ml-4 px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-bold rounded-lg text-xs shadow-[0_0_15px_rgba(251,191,36,0.3)] border border-yellow-300">
                    👑 GIGA GORG VIP
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      if (!user) return;
                      setShowVipModal(true);
                    }}
                    className="ml-4 px-3 py-1 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-amber-400 hover:to-orange-500 text-slate-300 hover:text-slate-900 font-bold rounded-lg text-xs transition-all border border-slate-600 hover:border-yellow-300 group shadow-lg"
                  >
                    👑 BUY VIP <span className="text-[10px] opacity-70">($5/mo)</span>
                  </button>
                )}

                <button onClick={() => signOut(auth)} className="ml-2 p-2 text-slate-500 hover:text-red-400"><LogOut size={16} /></button>
              </div>
            )}

            <p className="text-xl text-slate-300 mb-6 max-w-lg leading-relaxed">
              {modifiers.monkCartmanMode 
                ? "The master of focus has challenged you! Monk Cartman is testing your discipline and nutrition. Can you withstand his tranquility and authority?"
                : "The gluttonous demon is attacking with junk food! As he takes damage, his **I-Ready Test score** rises. Deflect the healthy food to hurt him!"}
            </p>

            <button 
              onClick={() => initGame()}
              className="px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-2xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.4)] mb-8"
            >
              START BATTLE
            </button>

            <div className="flex gap-12 mb-8 text-slate-300">
              <div className="flex flex-col items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <div className="text-4xl mb-3">⌨️</div>
                <span className="font-bold text-lg">WASD / Arrows</span>
                <span className="text-sm text-slate-400">to Move</span>
              </div>
              <div className="flex flex-col items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <div className="text-4xl mb-3">🥗</div>
                <span className="font-bold text-lg">Touch the Salad</span>
                <span className="text-sm text-slate-400">to Deflect it back!</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-8 w-full max-w-2xl">
              <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <div className="flex gap-4">
                  <button 
                    onClick={() => setMenuTab('modifiers')}
                    className={`text-xl font-bold uppercase tracking-widest pb-2 border-b-2 transition-colors ${menuTab === 'modifiers' ? 'text-blue-400 border-blue-400' : 'text-slate-500 border-transparent hover:text-slate-400'}`}
                  >
                    Modifiers
                  </button>
                  <button 
                    onClick={() => setMenuTab('skins')}
                    className={`text-xl font-bold uppercase tracking-widest pb-2 border-b-2 transition-colors flex items-center gap-2 ${menuTab === 'skins' ? 'text-purple-400 border-purple-400' : 'text-slate-500 border-transparent hover:text-slate-400'}`}
                  >
                    Skins Shop
                  </button>
                  <button 
                    onClick={() => setMenuTab('upgrades')}
                    className={`text-xl font-bold uppercase tracking-widest pb-2 border-b-2 transition-colors flex items-center gap-2 ${menuTab === 'upgrades' ? 'text-green-400 border-green-400' : 'text-slate-500 border-transparent hover:text-slate-400'}`}
                  >
                    Upgrades
                  </button>
                </div>
                <div className="flex items-center gap-3 bg-yellow-400/10 px-4 py-2 border border-yellow-400/30 rounded-full">
                  <img src="https://media.istockphoto.com/id/135194728/photo/rolling-in-the-money.jpg?s=1024x1024&w=is&k=20&c=Q7-e8Tcu5CV8nUZgAY5BloFUddWqPVvm1kO5hwGzfTA=" alt="Money" className="w-8 h-8 rounded-full object-cover border border-yellow-400/50" referrerPolicy="no-referrer" />
                  <span className="font-bold text-yellow-400 text-lg">{profile?.coins || 0}</span>
                </div>
              </div>

              <div className="h-[400px]">
                {menuTab === 'modifiers' ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/80 p-6 rounded-2xl border-2 border-slate-700 shadow-xl h-full overflow-y-auto">
                    {MODIFIER_DEFS.map((mod) => {
                      const cooldownMins = profile?.isVip ? 10 : 15;
                      const isTimeLocked = mod.id === 'aiMode' && profile?.lastAIPlay && (Date.now() - profile.lastAIPlay < cooldownMins * 60 * 1000);
                      const isLocked = isTimeLocked; // All other modifiers are unlocked!
                      return (
                        <button
                          key={mod.id}
                          disabled={isLocked}
                          onClick={() => {
                            setModifiers(prev => ({ ...prev, [mod.id]: !prev[mod.id as keyof Modifiers] }));
                            setMusicPlaying(true);
                          }}
                          className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all group relative ${
                            isLocked 
                              ? 'bg-slate-900/50 border-slate-800 opacity-50 grayscale cursor-not-allowed'
                              : modifiers[mod.id as keyof Modifiers] 
                                ? 'bg-blue-600/30 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                                : 'bg-slate-800 border-transparent hover:bg-slate-700'
                          }`}
                        >
                          <div className="w-14 h-14 mb-2 overflow-hidden rounded-lg bg-slate-700 flex items-center justify-center border border-slate-600 group-hover:border-slate-400 transition-colors">
                            {isLocked ? (
                              <div className="text-xl">🔒</div>
                            ) : (
                              <img 
                                src={mod.image} 
                                alt={mod.name} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>
                          <span className="font-bold text-[9px] uppercase tracking-tighter text-center leading-none">
                            {isLocked ? 'Locked' : mod.name}
                          </span>
                          
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 border border-slate-700 p-2 rounded text-[10px] w-32 z-50 pointer-events-none shadow-2xl">
                            {isTimeLocked ? `Cooldown active! Wait ${Math.ceil((cooldownMins * 60 * 1000 - (Date.now() - profile.lastAIPlay)) / 60000)}m.` : isLocked ? "Beat the boss to unlock more modifiers!" : mod.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : menuTab === 'upgrades' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/80 p-6 rounded-2xl border-2 border-slate-700 shadow-xl h-full overflow-y-auto">
                    {UPGRADE_SHOP.map((upg) => {
                      const currentLevel = profile?.upgrades?.[upg.id] || 0;
                      const isMaxed = currentLevel >= upg.maxLevel;
                      const nextPrice = upg.price + (currentLevel * Math.floor(upg.price * 0.5));
                      const canAfford = !!profile && profile.coins >= nextPrice;
                      
                      return (
                        <div key={upg.id} className="flex flex-col p-4 rounded-xl border border-slate-600 bg-slate-800 relative group">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{upg.icon}</span>
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-sm tracking-tighter uppercase">{upg.name}</span>
                                <span className="text-[10px] text-slate-400">{upg.desc}</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold bg-slate-700 px-2 py-1 rounded border border-slate-500">
                              LVL {currentLevel}/{upg.maxLevel}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 mb-3">
                            {Array.from({ length: upg.maxLevel }).map((_, i) => (
                              <div key={i} className={`h-1.5 flex-1 rounded-full ${i < currentLevel ? 'bg-green-400' : 'bg-slate-700'}`} />
                            ))}
                          </div>

                          <button
                            disabled={isMaxed || !canAfford}
                            onClick={async () => {
                              if (!user) return alert('Please sign in to buy upgrades!');
                              if (isMaxed) return;
                              if (canAfford) {
                                const newLevel = currentLevel + 1;
                                await updateDoc(doc(db, 'users', user.uid), {
                                  [`upgrades.${upg.id}`]: newLevel,
                                  coins: increment(-nextPrice)
                                });
                                setProfile({
                                  ...profile,
                                  upgrades: { ...(profile.upgrades || {}), [upg.id]: newLevel },
                                  coins: profile.coins - nextPrice
                                });
                              }
                            }}
                            className={`w-full py-2 rounded font-bold text-xs uppercase tracking-widest transition-all ${
                              isMaxed ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                              : canAfford ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                              : 'bg-slate-700 border border-slate-600 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {isMaxed ? 'MAX LEVEL' : `UPGRADE 🪙 ${nextPrice}`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/80 p-6 rounded-2xl border-2 border-slate-700 shadow-xl h-full overflow-y-auto">
                    {SHOP_SKINS.map((skin) => {
                      const isVipSkin = skin.id === 'vip_crown';
                      const skinPrice = profile?.isVip ? Math.floor(skin.price * 0.5) : skin.price;
                      const isUnlocked = profile?.unlockedSkins?.includes(skin.id) || skinPrice === 0 || (isVipSkin && profile?.isVip);
                      const isSelected = profile?.selectedSkin === skin.id || (!profile?.selectedSkin && skin.id === '🏃');
                      return (
                        <button
                          key={skin.id}
                          onClick={async () => {
                            if (!user) return alert('Please sign in to save skins!');
                            if (isUnlocked) {
                              await updateDoc(doc(db, 'users', user.uid), { selectedSkin: skin.id });
                              setProfile({ ...profile, selectedSkin: skin.id });
                            } else if (profile?.coins >= skinPrice && !isVipSkin) {
                              await updateDoc(doc(db, 'users', user.uid), { 
                                unlockedSkins: [...(profile.unlockedSkins || []), skin.id],
                                selectedSkin: skin.id,
                                coins: increment(-skinPrice)
                              });
                              setProfile({ 
                                ...profile, 
                                unlockedSkins: [...(profile.unlockedSkins || []), skin.id],
                                selectedSkin: skin.id,
                                coins: profile.coins - skinPrice
                              });
                            } else if (isVipSkin && !profile?.isVip) {
                              setShowVipModal(true);
                            }
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all group relative ${
                            isSelected ? 'bg-purple-600/30 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' 
                            : isUnlocked ? 'bg-slate-800 border-slate-600 hover:bg-slate-700'
                            : (profile && profile.coins >= skinPrice && !isVipSkin) ? 'bg-slate-800 border-green-600/50 hover:bg-green-800/30'
                            : 'bg-slate-900/50 border-slate-800 opacity-70 cursor-not-allowed'
                          }`}
                        >
                          {skin.type === 'image' ? (
                            <img src={skin.value} className="w-12 h-12 object-cover rounded mb-2 border border-slate-700" alt={skin.name} />
                          ) : (
                            <div className="text-4xl mb-2">{skin.value}</div>
                          )}
                          <span className="font-bold text-[11px] uppercase tracking-tighter text-center leading-none mb-2">
                            {skin.name}
                          </span>
                          <span className={`text-[10px] font-bold px-3 py-1 rounded bg-slate-950/80 flex gap-1 items-center ${isUnlocked ? 'text-green-400' : (profile && profile.coins >= skinPrice && !isVipSkin) ? 'text-yellow-400' : 'text-red-400'}`}>
                            {isSelected ? 'SELECTED' : isUnlocked ? 'EQUIP' : (isVipSkin && !profile?.isVip) ? 'VIP EXCLUSIVE' : (
                              <>
                                🪙 {skinPrice} 
                                {profile?.isVip && skin.price > 0 && !isVipSkin && <span className="line-through text-slate-500 text-[8px]">{skin.price}</span>}
                              </>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isPaused && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white p-8 text-center backdrop-blur-md z-50">
            <h2 className="text-6xl font-black mb-8 text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">PAUSED</h2>
            <div className="flex flex-col gap-6 w-full max-w-xs">
              <button 
                onClick={() => setIsPaused(false)}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                RESUME
              </button>
              <button 
                onClick={() => { setGameState('START'); setIsPaused(false); setMusicPlaying(false); }}
                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xl rounded-xl transition-all hover:scale-105 active:scale-95 border border-slate-600"
              >
                EXIT
              </button>
            </div>
          </div>
        )}

        {showVipModal && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white p-8 text-center backdrop-blur-md z-50 overflow-y-auto">
            <h2 className="text-5xl font-black mt-8 mb-6 text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)] border-b-2 border-amber-400/50 pb-4">👑 GIGA GORG VIP 👑</h2>
            
            <div className="bg-slate-900 border-2 border-yellow-500 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-[0_0_30px_rgba(251,191,36,0.2)] mb-8 text-left space-y-4">
              <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-yellow-500 mb-6 text-center">Unlock Ultimate Power!</p>
              
              <div className="flex gap-4 items-center">
                <span className="text-4xl drop-shadow-md">💰</span>
                <div>
                  <div className="font-bold text-lg text-amber-300">2x Coins Match Bonus</div>
                  <div className="text-sm text-slate-400">Earn double the coins per game!</div>
                </div>
              </div>
              
              <div className="flex gap-4 items-center">
                <span className="text-4xl drop-shadow-md">🛍️</span>
                <div>
                  <div className="font-bold text-lg text-amber-300">50% Off Skins Store</div>
                  <div className="text-sm text-slate-400">Half price on all skins!</div>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                <span className="text-4xl drop-shadow-md">🤖</span>
                <div>
                  <div className="font-bold text-lg text-amber-300">-5 Min AI Cooldown</div>
                  <div className="text-sm text-slate-400">Play the AI Director mode more often!</div>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                <span className="text-4xl drop-shadow-md">❤️</span>
                <div>
                  <div className="font-bold text-lg text-amber-300">+100 Max Health</div>
                  <div className="text-sm text-slate-400">Start every fight with a permanent health boost!</div>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                <span className="text-4xl drop-shadow-md">👑</span>
                <div>
                  <div className="font-bold text-lg text-amber-300">Exclusive Crown Skin</div>
                  <div className="text-sm text-slate-400">Show off your VIP status with a golden crown!</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => setShowVipModal(false)}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-600"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!user) return;
                  await updateDoc(doc(db, 'users', user.uid), { isVip: true });
                  setProfile({...profile, isVip: true});
                  setShowVipModal(false);
                }}
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-900 font-black rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(245,158,11,0.5)]"
              >
                SUBSCRIBE NOW - $5/mo
              </button>
            </div>
          </div>
        )}

        {gameState === 'DIALOGUE' && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white p-8 text-center backdrop-blur-md z-50">
            {dialogueMode === 'INTRO_CINEMATIC' ? (
              <div className="flex flex-col items-center justify-center w-full h-full relative overflow-hidden">
                <div className="absolute inset-0 bg-red-900/20 animate-pulse pointer-events-none" />
                <h1 className="text-6xl md:text-8xl font-black text-red-600 drop-shadow-[0_0_30px_rgba(220,38,38,1)] animate-bounce tracking-tighter uppercase mb-4 z-10">
                  Gorgotolisis Awakens
                </h1>
                
                <div className="relative my-8 z-10 transition-transform duration-1000 scale-125 hover:scale-150">
                  <img 
                    src={bossImage.src} 
                    className="w-64 h-64 md:w-96 md:h-96 object-contain drop-shadow-[0_0_50px_rgba(239,68,68,0.8)] filter contrast-125 brightness-110" 
                    alt="Gorgotolisis" 
                    referrerPolicy="no-referrer" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 mix-blend-multiply" />
                </div>
                
                <div className="text-2xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-red-500 animate-pulse max-w-4xl z-10 mt-6 min-h-[100px] italic">
                  "THE HEAVENS SHALL RAIN CHOLESTEROL, AND THE EARTH WILL QUAKE BENEATH MY CALORIC MIGHT!"
                </div>
                
                <button 
                  onClick={() => {
                    setDialogueMode('BACKSTORY');
                    setDialogueIndex(0);
                  }}
                  className="mt-12 px-12 py-5 bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white font-black text-2xl rounded-full transition-all hover:scale-110 shadow-[0_0_40px_rgba(220,38,38,0.5)] z-20 border-4 border-red-500/50 uppercase tracking-widest"
                >
                  Face the Demon
                </button>
              </div>
            ) : (
              <>
                {dialogueMode === 'CARTMAN' ? (
                  <div className="flex flex-col items-center mb-6">
                    <img src={helicopterImage.src} className="w-64 h-auto animate-bounce mb-4" alt="Helicopter" referrerPolicy="no-referrer" />
                    <img src={cartmanImage.src} className="w-40 h-auto" alt="Monk Cartman" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="text-8xl mb-6 animate-pulse drop-shadow-[0_0_30px_rgba(239,68,68,0.4)]">👹</div>
                )}
                <div className="max-w-2xl bg-slate-900 border-2 border-slate-700 p-8 rounded-2xl shadow-2xl">
                  <h3 className="text-amber-500 font-black text-2xl mb-4 tracking-widest uppercase">
                    {dialogueMode === 'CARTMAN' ? 'Monk Cartman Arrives' : (dialogueMode === 'TWIST' ? 'THE PLOT TWIST' : 'Gorgotolisis Speaks')}
                  </h3>
                  <p className="text-2xl font-medium leading-relaxed mb-8 min-h-[120px] text-slate-200 italic">
                    "{dialogueMode === 'BACKSTORY' ? BACKSTORY_DIALOGUE[dialogueIndex] : 
                      (dialogueMode === 'LIVE_PATH' ? LIVE_PATH_DIALOGUE[dialogueIndex] : 
                      (dialogueMode === 'CARTMAN' ? CARTMAN_DIALOGUE[dialogueIndex] : 
                      (dialogueMode === 'TWIST' ? CINEMATIC_TWIST_DIALOGUE[dialogueIndex] : BACKSTORY_DIALOGUE[dialogueIndex])))}"
                  </p>
                  
                  <div className="flex justify-center gap-6">
                    {dialogueMode === 'BACKSTORY' && dialogueIndex === BACKSTORY_DIALOGUE.length - 1 ? (
                      <>
                        <button 
                          onClick={() => {
                            setDialogueMode('LIVE_PATH');
                            setDialogueIndex(0);
                          }}
                          className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-full transition-all hover:scale-105 shadow-[0_0_20px_rgba(22,163,74,0.4)]"
                        >
                          I CHOOSE TO LIVE
                        </button>
                        <button 
                          onClick={() => {
                            boss.current.corruption = 1000;
                            boss.current.state = 'ULTIMATE_SPAM';
                            setGameState('PLAYING');
                          }}
                          className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-full transition-all hover:scale-105 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                        >
                          I CHOOSE TO DIE
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => {
                          const currentLines = dialogueMode === 'BACKSTORY' ? BACKSTORY_DIALOGUE : 
                                              (dialogueMode === 'LIVE_PATH' ? LIVE_PATH_DIALOGUE : 
                                              (dialogueMode === 'CARTMAN' ? CARTMAN_DIALOGUE : 
                                              (dialogueMode === 'SALAD_DISGUSTING' ? SALAD_DISGUSTING_DIALOGUE : 
                                              (dialogueMode === 'MONK_BOSS' ? MONK_BOSS_DIALOGUE :
                                              (dialogueMode === 'TWIST' ? CINEMATIC_TWIST_DIALOGUE : BACKSTORY_DIALOGUE)))));
                          if (dialogueIndex < currentLines.length - 1) {
                            setDialogueIndex(dialogueIndex + 1);
                          } else {
                            if (dialogueMode === 'MONK_BOSS') {
                              setGameState('PLAYING');
                              return;
                            }
                            if (dialogueMode === 'CARTMAN' || (dialogueMode === 'SALAD_DISGUSTING' && dialogueIndex === SALAD_DISGUSTING_DIALOGUE.length - 1)) {
                              // Spawn helicopter
                              helicopter.current.active = true;
                              helicopter.current.x = player.current.x - 1000;
                              helicopter.current.y = player.current.y - 500;
                              helicopter.current.targetX = player.current.x;
                              helicopter.current.targetY = player.current.y - 100;
                              if (dialogueMode === 'SALAD_DISGUSTING') {
                                helicopter.current.speed = 800; // Stronger Cartman
                              }
                            }
                            if (dialogueMode === 'TWIST') {
                              // Plot twist effect: massive corruption boost and size increase
                              boss.current.corruption = 900;
                              boss.current.width *= 1.5;
                              boss.current.height *= 1.5;
                              boss.current.state = 'SMASH_2';
                            }
                            setGameState('PLAYING');
                          }
                        }}
                        className="px-10 py-4 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-full transition-all hover:scale-105"
                      >
                        {((dialogueMode === 'CARTMAN' && dialogueIndex === CARTMAN_DIALOGUE.length - 1) || 
                          (dialogueMode === 'CARTMAN' && dialogueIndex === CARTMAN_DIALOGUE.length - 1)) ? 'START BATTLE!' : 'CONTINUE...'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {gameState === 'PLAYING' && modifiers.mobile && (
          <div className="absolute bottom-8 left-8 flex flex-col gap-4 z-40">
            <div className="grid grid-cols-3 gap-2">
              <div />
              <button 
                onMouseDown={() => { keys.current['w'] = true; }}
                onMouseUp={() => { keys.current['w'] = false; }}
                onTouchStart={() => { keys.current['w'] = true; }}
                onTouchEnd={() => { keys.current['w'] = false; }}
                className="w-16 h-16 bg-slate-800/80 border-2 border-slate-600 rounded-xl flex items-center justify-center text-2xl active:bg-slate-600 active:scale-95 transition-all"
              >
                ↑
              </button>
              <div />
              <button 
                onMouseDown={() => { keys.current['a'] = true; }}
                onMouseUp={() => { keys.current['a'] = false; }}
                onTouchStart={() => { keys.current['a'] = true; }}
                onTouchEnd={() => { keys.current['a'] = false; }}
                className="w-16 h-16 bg-slate-800/80 border-2 border-slate-600 rounded-xl flex items-center justify-center text-2xl active:bg-slate-600 active:scale-95 transition-all"
              >
                ←
              </button>
              <button 
                onMouseDown={() => { keys.current['s'] = true; }}
                onMouseUp={() => { keys.current['s'] = false; }}
                onTouchStart={() => { keys.current['s'] = true; }}
                onTouchEnd={() => { keys.current['s'] = false; }}
                className="w-16 h-16 bg-slate-800/80 border-2 border-slate-600 rounded-xl flex items-center justify-center text-2xl active:bg-slate-600 active:scale-95 transition-all"
              >
                ↓
              </button>
              <button 
                onMouseDown={() => { keys.current['d'] = true; }}
                onMouseUp={() => { keys.current['d'] = false; }}
                onTouchStart={() => { keys.current['d'] = true; }}
                onTouchEnd={() => { keys.current['d'] = false; }}
                className="w-16 h-16 bg-slate-800/80 border-2 border-slate-600 rounded-xl flex items-center justify-center text-2xl active:bg-slate-600 active:scale-95 transition-all"
              >
                →
              </button>
            </div>
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center text-white backdrop-blur-md">
            <div className="text-8xl mb-6">💀</div>
            <h2 className="text-6xl font-black mb-4 text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">DEFEATED</h2>
            <p className="text-2xl mb-10 text-red-200 font-medium">You succumbed to the junk food...</p>
            <button 
              onClick={initGame}
              className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(220,38,38,0.5)]"
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {gameState === 'VICTORY' && (
          <div className="absolute inset-0 bg-green-950/90 flex flex-col items-center justify-center text-white backdrop-blur-md">
            <div className="text-8xl mb-6">🏆</div>
            <h2 className="text-6xl font-black mb-4 text-green-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.8)]">VICTORY!</h2>
            <p className="text-2xl mb-10 text-green-200 font-medium max-w-lg text-center">
              You defeated {modifiers.monkCartmanMode ? 'Monk Cartman' : 'Gorgotolisis'} with the power of nutrition!
            </p>
            <button 
              onClick={initGame}
              className="px-10 py-4 bg-green-500 hover:bg-green-400 text-slate-950 font-black text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.5)]"
            >
              PLAY AGAIN
            </button>
          </div>
        )}

        {/* Admin Panel Toggle Button */}
        {isGodModeActive && gameState === 'PLAYING' && (
          <button 
            onClick={() => {
              setShowAdminPanel(!showAdminPanel);
              setAdminCorruption(boss.current.corruption);
            }}
            className="absolute top-4 left-4 z-50 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg shadow-lg transition-all"
          >
            {showAdminPanel ? 'CLOSE ADMIN' : 'OPEN ADMIN'}
          </button>
        )}

        {/* Admin Panel Overlay */}
        {showAdminPanel && isGodModeActive && (
          <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-md p-6 overflow-y-auto text-white">
            <h2 className="text-3xl font-black mb-6 text-amber-500 flex items-center gap-3">
              <span>🛠️</span> ADMIN CONTROL PANEL
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* I-Ready Test Control */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-slate-300">I-Ready Test Level</h3>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="1000" 
                    value={adminCorruption}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setAdminCorruption(val);
                      boss.current.corruption = val;
                      boss.current.regenRate = 15 + (val / 5);
                    }}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-2xl font-mono font-bold text-amber-500 w-20 text-right">{adminCorruption}%</span>
                </div>
                <div className="flex gap-2 mt-4">
                  {[0, 250, 500, 750, 1000].map(val => (
                    <button 
                      key={val}
                      onClick={() => {
                        setAdminCorruption(val);
                        boss.current.corruption = val;
                        boss.current.regenRate = 15 + (val / 5);
                      }}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold"
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Boss Controls */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-slate-300">Boss Management</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Regen Rate: {Math.floor(boss.current.regenRate)} HP/s</label>
                  <input 
                    type="range" min="0" max="500" step="5"
                    defaultValue={boss.current.regenRate}
                    onChange={(e) => { boss.current.regenRate = parseInt(e.target.value); }}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={(e) => {
                      isControllingBoss.current = !isControllingBoss.current;
                      (e.target as HTMLButtonElement).innerText = isControllingBoss.current ? 'BECOME PLAYER' : 'BECOME BOSS';
                    }}
                    className={`px-4 py-2 ${isControllingBoss.current ? 'bg-orange-600' : 'bg-slate-600'} rounded-lg font-bold transition-colors`}
                  >
                    {isControllingBoss.current ? 'BECOME PLAYER' : 'BECOME BOSS'}
                  </button>
                  <button 
                    onClick={() => { boss.current.health = 0; }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
                  >
                    INSTANT KILL
                  </button>
                  <button 
                    onClick={() => { boss.current.health = boss.current.maxHealth; }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
                  >
                    FULL HEAL
                  </button>
                  <button 
                    onClick={(e) => {
                      isBossFrozen.current = !isBossFrozen.current;
                      (e.target as HTMLButtonElement).innerText = isBossFrozen.current ? 'UNFREEZE BOSS' : 'FREEZE BOSS';
                    }}
                    className={`px-4 py-2 ${isBossFrozen.current ? 'bg-cyan-600' : 'bg-slate-600'} rounded-lg font-bold transition-colors`}
                  >
                    {isBossFrozen.current ? 'UNFREEZE BOSS' : 'FREEZE BOSS'}
                  </button>
                  <button 
                    onClick={() => {
                      const states: Boss['state'][] = ['NORMAL', 'SLAMMING', 'SUMMONING_DONGFISH', 'OREO_SANDWICH', 'CHEF_SPIN', 'OATMEAL_WALL', 'ULTIMATE_SPAM', 'CHERRY_CHARGE', 'DIZZY', 'RAGE', 'WHEELCHAIR', 'SMASH_2', 'SODA_BLAST', 'EARTHQUAKE_CRACK'];
                      const next = states[(states.indexOf(boss.current.state) + 1) % states.length];
                      boss.current.state = next;
                      boss.current.slamTimer = 5;
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold transition-colors"
                  >
                    NEXT STATE: {boss.current.state}
                  </button>
                </div>
              </div>

              {/* Player Controls */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-slate-300">Player Management</h3>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => { player.current.health = player.current.maxHealth; }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold transition-colors"
                  >
                    FULL HEAL
                  </button>
                  <button 
                    onClick={(e) => {
                      infiniteHealth.current = !infiniteHealth.current;
                      (e.target as HTMLButtonElement).innerText = infiniteHealth.current ? 'DISABLE INF HEALTH' : 'ENABLE INF HEALTH';
                    }}
                    className={`px-4 py-2 ${infiniteHealth.current ? 'bg-emerald-600' : 'bg-slate-600'} rounded-lg font-bold transition-colors`}
                  >
                    {infiniteHealth.current ? 'DISABLE INF HEALTH' : 'ENABLE INF HEALTH'}
                  </button>
                  <button 
                    onClick={() => { player.current.speed = player.current.speed === 350 ? 700 : 350; }}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg font-bold transition-colors"
                  >
                    {player.current.speed > 350 ? 'NORMAL SPEED' : 'SUPER SPEED'}
                  </button>
                </div>
              </div>

              {/* Utility Controls */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-slate-300">Utilities</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Projectile Speed Multiplier: {projectileSpeedMult.current}x</label>
                  <input 
                    type="range" min="0.1" max="5" step="0.1"
                    defaultValue={projectileSpeedMult.current}
                    onChange={(e) => { projectileSpeedMult.current = parseFloat(e.target.value); }}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => { projectiles.current = []; }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-colors"
                  >
                    CLEAR PROJECTILES
                  </button>
                  <button 
                    onClick={() => {
                      projectiles.current.push({
                        x: player.current.x,
                        y: player.current.y - 100,
                        vx: 0,
                        vy: 0,
                        radius: 20,
                        emoji: '🩹',
                        isPlayer: false,
                        isHealthy: false,
                        isBandAid: true,
                        rotation: 0,
                        rotationSpeed: 0,
                      });
                    }}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg font-bold transition-colors"
                  >
                    SPAWN BAND-AID
                  </button>
                  <button 
                    onClick={() => {
                      projectiles.current.push({
                        x: player.current.x,
                        y: player.current.y - 100,
                        vx: 0,
                        vy: 0,
                        radius: 20,
                        emoji: HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)],
                        isPlayer: false,
                        isHealthy: true,
                        rotation: 0,
                        rotationSpeed: 0,
                      });
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold transition-colors"
                  >
                    SPAWN SALAD
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 text-center">
              <button 
                onClick={() => setShowAdminPanel(false)}
                className="px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-full font-black text-lg transition-all"
              >
                BACK TO GAME
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-6 text-slate-500 text-sm font-medium">
        Use WASD to move. Touch healthy food to deflect it.
      </div>
    </div>
  );
}
