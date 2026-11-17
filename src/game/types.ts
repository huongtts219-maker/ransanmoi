export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  pipeSpeed: number; // px per second
  pipeGap: number; // vertical gap in px
  pipeSpawnInterval: number; // seconds between pipes
  gravity: number; // px / s^2
  jumpVelocity: number; // px / s (negative = upward)
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Dễ',
    pipeSpeed: 155,
    pipeGap: 168,
    pipeSpawnInterval: 1.65,
    gravity: 1120,
    jumpVelocity: -365,
  },
  normal: {
    id: 'normal',
    label: 'Bình thường',
    pipeSpeed: 185,
    pipeGap: 146,
    pipeSpawnInterval: 1.42,
    gravity: 1280,
    jumpVelocity: -395,
  },
  hard: {
    id: 'hard',
    label: 'Khó',
    pipeSpeed: 225,
    pipeGap: 128,
    pipeSpawnInterval: 1.18,
    gravity: 1450,
    jumpVelocity: -420,
  },
};

export const CANVAS_WIDTH = 420;
export const CANVAS_HEIGHT = 640;
export const GROUND_HEIGHT = 96;
export const PLAYABLE_HEIGHT = CANVAS_HEIGHT - GROUND_HEIGHT;
export const BIRD_X = 108;
export const BIRD_RADIUS = 16;
export const PIPE_WIDTH = 66;

export interface BirdState {
  y: number;
  vy: number;
  rotation: number; // radians
  wingPhase: number;
}

export interface PipePair {
  id: number;
  x: number;
  gapY: number; // center Y of the gap
  gapHeight: number;
  passed: boolean;
}

export interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  opacity: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface MedalTier {
  name: string;
  minScore: number;
  accentColor: string;
  bgColor: string;
}

export function getMedalForScore(score: number): MedalTier | null {
  if (score >= 40) {
    return {
      name: 'Bạch kim',
      minScore: 40,
      accentColor: '#0284C7',
      bgColor: '#E0F2FE',
    };
  }
  if (score >= 25) {
    return {
      name: 'Vàng',
      minScore: 25,
      accentColor: '#D97706',
      bgColor: '#FEF3C7',
    };
  }
  if (score >= 12) {
    return {
      name: 'Bạc',
      minScore: 12,
      accentColor: '#475569',
      bgColor: '#F1F5F9',
    };
  }
  if (score >= 5) {
    return {
      name: 'Đồng',
      minScore: 5,
      accentColor: '#B45309',
      bgColor: '#FFEDD5',
    };
  }
  return null;
}
