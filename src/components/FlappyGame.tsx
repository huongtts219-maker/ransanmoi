import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../audio/soundEffects';
import { renderGameFrame } from '../game/renderer';
import {
  BIRD_RADIUS,
  BIRD_X,
  BirdState,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  Cloud,
  DIFFICULTY_CONFIGS,
  Difficulty,
  GameState,
  PIPE_WIDTH,
  PLAYABLE_HEIGHT,
  Particle,
  PipePair,
  getMedalForScore,
} from '../game/types';

const STORAGE_PREFIX = 'flappy_sky_best_';

function loadBestScore(difficulty: Difficulty): number {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${difficulty}`);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(difficulty: Difficulty, score: number): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${difficulty}`, String(score));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

function createInitialClouds(): Cloud[] {
  return [
    { x: 50, y: 88, scale: 0.9, speed: 16, opacity: 0.85 },
    { x: 205, y: 142, scale: 0.72, speed: 12, opacity: 0.75 },
    { x: 350, y: 74, scale: 1.05, speed: 20, opacity: 0.9 },
    { x: 460, y: 176, scale: 0.65, speed: 14, opacity: 0.65 },
  ];
}

export const FlappyGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(() => loadBestScore('normal'));
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Mutable simulation refs for 60fps+ smooth animation loop
  const gameStateRef = useRef<GameState>('TITLE_MENU');
  const difficultyRef = useRef<Difficulty>('normal');
  const scoreRef = useRef<number>(0);
  const bestScoreRef = useRef<number>(bestScore);
  const gameOverTimeRef = useRef<number>(0);

  const birdRef = useRef<BirdState>({
    y: PLAYABLE_HEIGHT * 0.45,
    vy: 0,
    rotation: 0,
    wingPhase: 0,
  });
  const pipesRef = useRef<PipePair[]>([]);
  const cloudsRef = useRef<Cloud[]>(createInitialClouds());
  const particlesRef = useRef<Particle[]>([]);
  const groundOffsetRef = useRef<number>(0);
  const cityOffsetRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const pipeIdCounterRef = useRef<number>(1);
  const flashAlphaRef = useRef<number>(0);
  const shakeTimerRef = useRef<number>(0);
  const idleTimeRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    difficultyRef.current = difficulty;
    const loaded = loadBestScore(difficulty);
    bestScoreRef.current = loaded;
    setBestScore(loaded);
  }, [difficulty]);

  const spawnParticles = useCallback(
    (x: number, y: number, count: number, colors: string[], spreadSpeed: number) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 35 + Math.random() * spreadSpeed;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed - 30,
          vy: Math.sin(angle) * speed - 20,
          life: 0.35 + Math.random() * 0.25,
          maxLife: 0.6,
          size: 2.5 + Math.random() * 3,
          color: colors[i % colors.length],
        });
      }
    },
    []
  );

  const resetSimulation = useCallback(() => {
    birdRef.current = {
      y: PLAYABLE_HEIGHT * 0.44,
      vy: 0,
      rotation: 0,
      wingPhase: 0,
    };
    pipesRef.current = [];
    particlesRef.current = [];
    spawnTimerRef.current = 0.55; // First pipe arrives cleanly after start
    scoreRef.current = 0;
    flashAlphaRef.current = 0;
    shakeTimerRef.current = 0;
    setScore(0);
    setIsNewRecord(false);
  }, []);

  const triggerFlap = useCallback(() => {
    const config = DIFFICULTY_CONFIGS[difficultyRef.current];
    birdRef.current.vy = config.jumpVelocity;
    birdRef.current.wingPhase = 0;
    soundEngine.playFlap();
    spawnParticles(
      BIRD_X - 14,
      birdRef.current.y + 4,
      5,
      ['#FEF08A', '#FFFFFF', '#FDE047'],
      70
    );
  }, [spawnParticles]);

  const startGame = useCallback(() => {
    resetSimulation();
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
    triggerFlap();
  }, [resetSimulation, triggerFlap]);

  const returnToTitle = useCallback(() => {
    resetSimulation();
    gameStateRef.current = 'TITLE_MENU';
    setGameState('TITLE_MENU');
  }, [resetSimulation]);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      gameStateRef.current = 'PAUSED';
      setGameState('PAUSED');
    } else if (gameStateRef.current === 'PAUSED') {
      gameStateRef.current = 'PLAYING';
      setGameState('PLAYING');
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const triggerGameOver = useCallback(() => {
    if (gameStateRef.current === 'GAME_OVER') return;
    gameStateRef.current = 'GAME_OVER';
    gameOverTimeRef.current = performance.now();
    flashAlphaRef.current = 0.72;
    shakeTimerRef.current = 0.24;
    soundEngine.playCrash();

    spawnParticles(
      BIRD_X,
      birdRef.current.y,
      14,
      ['#FACC15', '#F97316', '#FFFFFF', '#FEF08A'],
      140
    );

    const finalScore = scoreRef.current;
    if (finalScore > bestScoreRef.current) {
      bestScoreRef.current = finalScore;
      saveBestScore(difficultyRef.current, finalScore);
      setBestScore(finalScore);
      setIsNewRecord(true);
    }

    setGameState('GAME_OVER');
  }, [spawnParticles]);

  // Handle canvas pointer down (zero-latency touch/mouse flap)
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const state = gameStateRef.current;
      if (state === 'PLAYING') {
        triggerFlap();
      } else if (state === 'TITLE_MENU') {
        startGame();
      }
    },
    [startGame, triggerFlap]
  );

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        const state = gameStateRef.current;
        if (state === 'PLAYING') {
          triggerFlap();
        } else if (state === 'TITLE_MENU') {
          startGame();
        } else if (state === 'GAME_OVER') {
          if (performance.now() - gameOverTimeRef.current > 380) {
            startGame();
          }
        } else if (state === 'PAUSED') {
          togglePause();
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameStateRef.current === 'PLAYING' || gameStateRef.current === 'PAUSED') {
          e.preventDefault();
          togglePause();
        }
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startGame, toggleMute, togglePause, triggerFlap]);

  // Main requestAnimationFrame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configure crisp HiDPI scaling
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let animationFrameId = 0;
    let lastTimestamp = performance.now();

    const step = (now: number) => {
      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      // Clamp dt to prevent giant physics jumps when switching tabs
      const dt = Math.min(rawDt, 0.05);

      const state = gameStateRef.current;
      const config = DIFFICULTY_CONFIGS[difficultyRef.current];

      // Always drift clouds subtly unless paused
      if (state !== 'PAUSED') {
        for (const cloud of cloudsRef.current) {
          cloud.x -= cloud.speed * dt;
          if (cloud.x < -90) {
            cloud.x = CANVAS_WIDTH + 70;
            cloud.y = 55 + Math.random() * 145;
          }
        }
      }

      if (state === 'TITLE_MENU') {
        idleTimeRef.current += dt;
        groundOffsetRef.current += config.pipeSpeed * 0.65 * dt;
        cityOffsetRef.current += config.pipeSpeed * 0.16 * dt;

        birdRef.current.y = PLAYABLE_HEIGHT * 0.44 + Math.sin(idleTimeRef.current * 4.2) * 9;
        birdRef.current.rotation = Math.sin(idleTimeRef.current * 4.2) * 0.06;
        birdRef.current.wingPhase += dt * 11;
      } else if (state === 'PLAYING') {
        groundOffsetRef.current += config.pipeSpeed * dt;
        cityOffsetRef.current += config.pipeSpeed * 0.22 * dt;

        // Bird physics
        const bird = birdRef.current;
        bird.vy += config.gravity * dt;
        bird.y += bird.vy * dt;
        bird.wingPhase += dt * (bird.vy < 0 ? 18 : 9);

        // Smooth pitch angle: nose up rapidly on flap, dive smoothly when falling
        const targetRotation =
          bird.vy < 0
            ? -0.42
            : Math.min(Math.PI / 2.2, ((bird.vy - 80) / 520) * (Math.PI / 2.2));
        bird.rotation += (targetRotation - bird.rotation) * Math.min(1, dt * 12);

        // Ceiling guard
        if (bird.y < BIRD_RADIUS) {
          bird.y = BIRD_RADIUS;
          if (bird.vy < 0) bird.vy = 0;
        }

        // Ground collision
        if (bird.y + BIRD_RADIUS >= PLAYABLE_HEIGHT) {
          bird.y = PLAYABLE_HEIGHT - BIRD_RADIUS;
          triggerGameOver();
        }

        // Spawn pipes
        spawnTimerRef.current -= dt;
        if (spawnTimerRef.current <= 0) {
          spawnTimerRef.current = config.pipeSpawnInterval;
          const minGapY = 82 + config.pipeGap / 2;
          const maxGapY = PLAYABLE_HEIGHT - 82 - config.pipeGap / 2;
          const gapY = minGapY + Math.random() * (maxGapY - minGapY);

          pipesRef.current.push({
            id: pipeIdCounterRef.current++,
            x: CANVAS_WIDTH + 16,
            gapY,
            gapHeight: config.pipeGap,
            passed: false,
          });
        }

        // Update pipes + check collisions & scoring
        const hitboxRadius = BIRD_RADIUS - 3.5; // Fair, forgiving hitbox
        const remainingPipes: PipePair[] = [];

        for (const pipe of pipesRef.current) {
          pipe.x -= config.pipeSpeed * dt;

          // Score check when bird passes center of pipe
          if (!pipe.passed && pipe.x + PIPE_WIDTH / 2 < BIRD_X) {
            pipe.passed = true;
            scoreRef.current += 1;
            const nextScore = scoreRef.current;
            setScore(nextScore);
            const isMilestone = nextScore > 0 && nextScore % 10 === 0;
            soundEngine.playScore(isMilestone);
            if (isMilestone) {
              spawnParticles(
                BIRD_X + 10,
                bird.y - 16,
                10,
                ['#FACC15', '#38BDF8', '#4ADE80', '#FFFFFF'],
                110
              );
            }
          }

          // Circle-to-AABB collision check for top and bottom pipe
          const withinPipeX =
            BIRD_X + hitboxRadius > pipe.x + 2 &&
            BIRD_X - hitboxRadius < pipe.x + PIPE_WIDTH - 2;

          if (withinPipeX) {
            const gapTop = pipe.gapY - pipe.gapHeight / 2;
            const gapBottom = pipe.gapY + pipe.gapHeight / 2;
            if (bird.y - hitboxRadius < gapTop || bird.y + hitboxRadius > gapBottom) {
              triggerGameOver();
            }
          }

          if (pipe.x + PIPE_WIDTH > -30) {
            remainingPipes.push(pipe);
          }
        }
        pipesRef.current = remainingPipes;
      } else if (state === 'GAME_OVER') {
        // Let bird settle down to the ground after impact
        const bird = birdRef.current;
        if (bird.y + BIRD_RADIUS < PLAYABLE_HEIGHT) {
          bird.vy += 1550 * dt;
          bird.y = Math.min(PLAYABLE_HEIGHT - BIRD_RADIUS, bird.y + bird.vy * dt);
          bird.rotation = Math.min(Math.PI / 2, bird.rotation + dt * 6);
        }
      }

      // Update particles (even on game over so burst plays out)
      if (state !== 'PAUSED' && particlesRef.current.length > 0) {
        const nextParticles: Particle[] = [];
        for (const p of particlesRef.current) {
          p.life -= dt;
          if (p.life > 0) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 260 * dt;
            nextParticles.push(p);
          }
        }
        particlesRef.current = nextParticles;
      }

      // Decay screen flash and shake
      if (flashAlphaRef.current > 0) {
        flashAlphaRef.current = Math.max(0, flashAlphaRef.current - dt * 2.8);
      }

      let shakeX = 0;
      let shakeY = 0;
      if (shakeTimerRef.current > 0) {
        shakeTimerRef.current = Math.max(0, shakeTimerRef.current - dt);
        const intensity = (shakeTimerRef.current / 0.24) * 6;
        shakeX = (Math.random() - 0.5) * 2 * intensity;
        shakeY = (Math.random() - 0.5) * 2 * intensity;
      }

      renderGameFrame({
        ctx,
        bird: birdRef.current,
        pipes: pipesRef.current,
        clouds: cloudsRef.current,
        particles: particlesRef.current,
        groundOffset: groundOffsetRef.current,
        cityOffset: cityOffsetRef.current,
        score: scoreRef.current,
        flashAlpha: flashAlphaRef.current,
        shakeX,
        shakeY,
      });

      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [spawnParticles, triggerGameOver]);

  const medal = getMedalForScore(score);

  return (
    <div className="flex flex-col items-center w-full max-w-[440px] mx-auto select-none">
      {/* Compact Top Control Bar */}
      <div className="w-full flex items-center justify-between gap-4 mb-3 px-1">
        <div className="flex items-baseline gap-2.5">
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
            Flappy Sky
          </h1>
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            {DIFFICULTY_CONFIGS[difficulty].label}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mr-1">
            <Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <span className="font-mono-num font-bold text-slate-900">{bestScore}</span>
          </div>

          {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
            <button
              type="button"
              onClick={togglePause}
              aria-label={gameState === 'PAUSED' ? 'Tiếp tục trò chơi' : 'Tạm dừng trò chơi'}
              title={gameState === 'PAUSED' ? 'Tiếp tục (P)' : 'Tạm dừng (P)'}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 active:scale-95 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 shadow-xs"
            >
              {gameState === 'PAUSED' ? (
                <Play className="w-4 h-4 fill-current" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            title={isMuted ? 'Bật âm thanh (M)' : 'Tắt âm thanh (M)'}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 active:scale-95 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 shadow-xs"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Game Viewport */}
      <div className="relative w-full aspect-[420/640] max-h-[calc(100dvh-136px)] rounded-2xl overflow-hidden shadow-[0_20px_50px_-12px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/10 bg-sky-300">
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          className="block w-full h-full touch-none cursor-pointer"
          aria-label="Khu vực chơi Flappy Sky"
        />

        {/* Active Gameplay Score HUD */}
        {gameState === 'PLAYING' && (
          <div className="pointer-events-none absolute top-6 inset-x-0 flex justify-center">
            <span
              className="font-display font-extrabold text-5xl text-white tabular-nums tracking-tight drop-shadow-[0_3px_0_rgba(15,23,42,0.75)]"
              style={{ WebkitTextStroke: '2px #0f172a' }}
            >
              {score}
            </span>
          </div>
        )}

        {/* Title Menu Overlay */}
        {gameState === 'TITLE_MENU' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-10 px-6">
            <div className="text-center mt-2">
              <h2
                className="font-display text-4xl sm:text-[42px] font-extrabold tracking-tight text-white drop-shadow-[0_3px_0_rgba(15,23,42,0.75)]"
                style={{ WebkitTextStroke: '1.5px #0f172a' }}
              >
                Flappy Sky
              </h2>
              <p className="mt-1.5 text-sm font-semibold text-slate-900/85 bg-white/75 backdrop-blur-xs px-3 py-1 rounded-lg inline-block">
                Nhấn Space hoặc chạm để bay
              </p>
            </div>

            <div className="pointer-events-auto w-full max-w-[300px] bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-xl border border-slate-200/80 text-center">
              <div className="text-xs font-semibold text-slate-500 mb-2">Chọn tốc độ</div>
              <div
                className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-4"
                role="group"
                aria-label="Độ khó"
              >
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((level) => {
                  const active = difficulty === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDifficulty(level)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {DIFFICULTY_CONFIGS[level].label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={startGame}
                className="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-display font-bold text-base shadow-sm transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 whitespace-nowrap"
              >
                Bắt đầu chơi
              </button>
            </div>
          </div>
        )}

        {/* Pause Overlay */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center p-6">
            <div className="w-full max-w-[280px] bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-center">
              <h2 className="font-display text-2xl font-bold text-slate-900">Đang tạm dừng</h2>
              <p className="mt-1 text-sm text-slate-500">
                Điểm hiện tại: <span className="font-mono-num font-bold text-slate-800">{score}</span>
              </p>

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={togglePause}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Tiếp tục</span>
                </button>
                <button
                  type="button"
                  onClick={startGame}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Chơi lại</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center p-6">
            <div className="w-full max-w-[310px] bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-center">
              <h2 className="font-display text-2xl font-extrabold text-slate-900">Kết thúc lượt</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Chế độ {DIFFICULTY_CONFIGS[difficulty].label}
                {isNewRecord ? ' · Kỷ lục mới' : ''}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
                <div>
                  <div className="text-xs font-medium text-slate-500">Điểm số</div>
                  <div className="mt-1 font-mono-num text-3xl font-bold text-slate-900">
                    {score}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Cao nhất</div>
                  <div className="mt-1 font-mono-num text-3xl font-bold text-amber-600">
                    {bestScore}
                  </div>
                </div>
              </div>

              {medal && (
                <div className="mt-3 text-sm font-semibold" style={{ color: medal.accentColor }}>
                  Huy hiệu {medal.name}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={startGame}
                  className="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-display font-bold text-base shadow-sm transition cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Chơi lại</span>
                </button>
                <button
                  type="button"
                  onClick={returnToTitle}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition cursor-pointer whitespace-nowrap"
                >
                  Đổi độ khó
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quiet Unboxed Keyboard Controls Hint */}
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span>Space / ↑ / Nhấp chuột để bay</span>
        <span aria-hidden="true">·</span>
        <span>P để tạm dừng</span>
        <span aria-hidden="true">·</span>
        <span>M để tắt tiếng</span>
      </div>
    </div>
  );
};
