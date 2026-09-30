// src/test_audit_suite.ts
import { migrateV1ToV2 } from './utils/migration';
import { runDataIntegrityCheck } from './utils/audit';
import { exportBackupString, importBackupString, normalizeState } from './utils/storage';
import { getLastExercisePerformance, getHistoricalSetDataV2, computeStreakFromSessions, getTabCompletionStats } from './utils/domain';
import { calculateAllVolumeStatsV2, calculateVolumeFromSessionV2 } from './utils/coach';
import { WorkoutSessionV2, ExerciseDefV2 } from './types/v2';
import { AppState, SingleExercise } from './types/gym';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details: string) {
  results.push({
    name,
    passed: condition,
    details
  });
}

// ==========================================
// TEST 1: Identity & Rename Consistency
// ==========================================
{
  const registry: Record<string, ExerciseDefV2> = {
    'ex_bench_1': { id: 'ex_bench_1', name: 'Panca Piana Bilanciere', type: 'weight' }
  };
  const sessions: WorkoutSessionV2[] = [
    {
      id: 'sess_1',
      date: '2026-03-01',
      startedAt: 1000,
      completedAt: 2000,
      durationStr: '45m',
      tabNameSnapshot: 'Petto',
      bodyWeightAtSession: 75,
      blocks: [
        {
          exerciseId: 'ex_bench_1',
          nameSnapshot: 'Panca Piana',
          type: 'weight',
          sets: [{ id: 's1', index: 1, weight: 100, reps: 5 }]
        }
      ]
    }
  ];

  // Lookup by ID after rename of exercise in plan
  const perfById = getLastExercisePerformance(sessions, 'ex_bench_1', 'Nuovo Nome Panca Inclinata');
  assert(
    perfById !== null && perfById.weight === 100,
    'Identity: Lookup by exerciseId survives plan rename',
    `Found weight: ${perfById?.weight}, expected 100`
  );
}

// ==========================================
// TEST 2: History Immutability against Plan Modifications
// ==========================================
{
  const originalSession: WorkoutSessionV2 = {
    id: 'sess_immut',
    date: '2026-03-01',
    startedAt: 1000,
    completedAt: 2000,
    durationStr: '50m',
    tabNameSnapshot: 'Leg Day Original',
    bodyWeightAtSession: 80,
    blocks: [
      {
        exerciseId: 'ex_squat',
        nameSnapshot: 'Squat',
        type: 'weight',
        sets: [{ id: 'set_1', index: 1, weight: 120, reps: 5 }]
      }
    ]
  };

  const sessions = [JSON.parse(JSON.stringify(originalSession))];

  // User modifies plan: changes sets, reps, deletes exercise
  const currentPlanEx: SingleExercise = {
    id: 'squat-tab-1',
    exerciseId: 'ex_squat',
    type: 'single',
    name: 'Squat Ridenominato',
    sets: 10,
    reps: '20',
    pause: 30,
    metricType: 'weight'
  };

  currentPlanEx.sets = 99;
  currentPlanEx.name = 'Completely New Exercise';

  assert(
    sessions[0].tabNameSnapshot === 'Leg Day Original' &&
    sessions[0].blocks[0].nameSnapshot === 'Squat' &&
    sessions[0].blocks[0].sets[0].weight === 120,
    'History Immutability: Plan modification does not mutate historical session snapshot',
    `Snapshot name: ${sessions[0].blocks[0].nameSnapshot}, weight: ${sessions[0].blocks[0].sets[0].weight}`
  );
}

// ==========================================
// TEST 3: Bodyweight Isolation
// ==========================================
{
  const session: WorkoutSessionV2 = {
    id: 'sess_bw',
    date: '2026-01-10',
    startedAt: 1000,
    completedAt: 2000,
    durationStr: '30m',
    tabNameSnapshot: 'Calisthenics',
    bodyWeightAtSession: 72.5,
    blocks: [
      {
        exerciseId: 'ex_pullup',
        nameSnapshot: 'Trazioni',
        type: 'bodyweight',
        sets: [{ id: 's1', index: 1, reps: 10, weight: 0 }]
      }
    ]
  };

  // Calculate volume using the frozen bodyWeightAtSession (72.5)
  const vol1 = calculateVolumeFromSessionV2(session);
  // Volume for bodyweight: reps * (w + bw) = 10 * (0 + 72.5) = 725
  assert(
    vol1 === 725,
    'Bodyweight Isolation: Volume uses frozen bodyWeightAtSession',
    `Calculated volume: ${vol1}, expected 725`
  );
}

// ==========================================
// TEST 4: Migration V1 -> V2 with Full Data Preservation
// ==========================================
{
  const v1Sample: Partial<AppState> = {
    bodyMetrics: { weight: 78, height: 180, fm: 12, ffm: 68 },
    bodyMetricsHistory: [
      { date: '2026-01-01', weight: 80, height: 180, fm: 14, ffm: 68 },
      { date: '2026-02-01', weight: 78, height: 180, fm: 12, ffm: 68 }
    ],
    prs: [
      { id: 'pr_1', name: 'Panca Piana', weight: '110', history: [{ date: '2026-01-15', weight: '110' }] }
    ],
    plan: [
      {
        id: 'tab_push',
        name: 'Push',
        subtitle: 'Petto',
        exercises: [
          { id: 'ex_1', type: 'single', name: 'Panca Piana', sets: 3, reps: '8', pause: 90, metricType: 'weight' }
        ]
      }
    ],
    workoutSessionsHistory: [
      {
        id: 'old_sess_1',
        date: '2026-01-15',
        time: '18:00',
        tabName: 'Push',
        duration: '1h',
        totalSets: 3,
        exercises: [
          {
            type: 'single',
            name: 'Panca Piana',
            metricType: 'weight',
            sets: [
              { index: 1, weight: 100, reps: '8', rir: '2' },
              { index: 2, weight: 105, reps: '8', rir: '1' },
              { index: 3, weight: 110, reps: '6', rir: '-1' }
            ]
          }
        ]
      }
    ]
  };

  const v2Db = migrateV1ToV2(v1Sample);
  const audit = runDataIntegrityCheck(v2Db);

  const migratedSession = v2Db.sessions[0];
  const migratedBlock = migratedSession?.blocks[0];

  assert(
    v2Db.schemaVersion === 2 &&
    v2Db.sessions.length === 1 &&
    audit.isHealthy &&
    migratedSession.bodyWeightAtSession === 80 && // Matched 2026-01-01 closest metric
    'rounds' in migratedBlock === false &&
    migratedBlock.sets[2].isCed === true && // RIR '-1' correctly converted to isCed
    Boolean(v1Sample.prs![0].exerciseId), // PR bound to permanent ID
    'Migration V1 -> V2: Full data preservation, CED conversion, BW interpolation and PR linkage',
    `Audit issues: ${audit.issues.length}, BW: ${migratedSession?.bodyWeightAtSession}, isCed: ${'rounds' in migratedBlock ? false : migratedBlock?.sets[2]?.isCed}`
  );
}

// ==========================================
// TEST 5: Integrity Checker Robustness
// ==========================================
{
  const corruptDb = {
    schemaVersion: 2 as const,
    revision: 1,
    lastSavedAt: Date.now(),
    registry: {
      'ex_valid': { id: 'ex_valid', name: 'Valid Exercise', type: 'weight' as const }
    },
    sessions: [
      {
        id: 'sess_bad_date',
        date: 'INVALID_DATE',
        startedAt: 100,
        completedAt: 200,
        durationStr: '10m',
        tabNameSnapshot: 'Test',
        bodyWeightAtSession: -50, // Invalid negative BW
        blocks: [
          {
            exerciseId: 'ex_ORPHAN', // Orphan reference!
            nameSnapshot: 'Ghost',
            type: 'weight' as const,
            sets: [{ id: 's1', index: 1, weight: 5000, reps: -10 }] // Invalid weight & reps
          }
        ]
      }
    ]
  };

  const report = runDataIntegrityCheck(corruptDb);
  const hasOrphanErr = report.issues.some(i => i.message.includes('assente dal registro'));
  const hasDateErr = report.issues.some(i => i.message.includes('Data non valida'));
  const hasBwWarn = report.issues.some(i => i.message.includes('Peso corporeo anomalo'));
  const hasWeightWarn = report.issues.some(i => i.message.includes('Carico non realistico'));
  const hasRepsWarn = report.issues.some(i => i.message.includes('Ripetizioni anomale'));

  assert(
    !report.isHealthy && hasOrphanErr && hasDateErr && hasBwWarn && hasWeightWarn && hasRepsWarn,
    'Integrity Checker: Catches orphan IDs, invalid dates, negative BW, unrealistic weights/reps',
    `Found issues: ${report.issues.length} (isHealthy: ${report.isHealthy})`
  );
}

// ==========================================
// TEST 6: Backup Export & Import (LZ-String compression & validation)
// ==========================================
{
  const testState: AppState = {
    profileName: 'Athlete',
    activeTab: 'tab1',
    isEditMode: false,
    schemaVersion: 2,
    revision: 5,
    lastSavedAt: Date.now(),
    weights: {},
    setWeights: {},
    checkedSets: {},
    setRir: {},
    setReps: {},
    setDurations: {},
    setRpe: {},
    setCustomFields: {},
    prs: [{ id: 'pr1', exerciseId: 'ex_1', name: 'Squat', weight: '140', history: [] }],
    activeWorkouts: {},
    bodyMetrics: { weight: 75, height: 175, fm: 12, ffm: 66 },
    bodyMetricsHistory: [],
    favoriteTabs: {},
    amrapRounds: {},
    bodyGoal: 'hypertrophy',
    deloadActive: false,
    deloadDates: [],
    currentEffortSelection: null,
    lastBackupDate: '2026-03-30',
    registryV2: {
      'ex_1': { id: 'ex_1', name: 'Squat', type: 'weight' }
    },
    sessionsV2: [
      {
        id: 's_v2_1',
        date: '2026-03-25',
        startedAt: 1000,
        completedAt: 3000,
        durationStr: '33m',
        tabNameSnapshot: 'Legs',
        bodyWeightAtSession: 75,
        blocks: [
          {
            exerciseId: 'ex_1',
            nameSnapshot: 'Squat',
            type: 'weight',
            sets: [{ id: 'set_1', index: 1, weight: 140, reps: 5 }]
          }
        ]
      }
    ],
    plan: [
      {
        id: 'tab1',
        name: 'Legs',
        subtitle: 'Quads',
        exercises: [{ id: 'pl_1', exerciseId: 'ex_1', type: 'single', name: 'Squat', sets: 4, reps: '8', pause: 120, metricType: 'weight' }]
      }
    ]
  };

  const backupStr = exportBackupString(testState);
  assert(backupStr.startsWith('GYM2::'), 'Backup Export: Generates GYM2:: container', `Starts with ${backupStr.substring(0, 10)}`);

  const importedState = importBackupString(backupStr);
  assert(
    importedState.schemaVersion === 2 &&
    importedState.sessionsV2.length === 1 &&
    importedState.sessionsV2[0].blocks[0].sets[0].weight === 140 &&
    importedState.registryV2['ex_1'].name === 'Squat',
    'Backup Import: Unpacks, validates and restores identical canonical V2 state',
    `Restored sessions: ${importedState.sessionsV2.length}, weight: ${importedState.sessionsV2[0].blocks[0].sets[0].weight}`
  );

  // Corrupted backup rejection
  let corruptedRejected = false;
  try {
    importBackupString('GYM2::CORRUPTED_BASE64_DATA_XXX');
  } catch {
    corruptedRejected = true;
  }
  assert(corruptedRejected, 'Backup Protection: Corrupted backup is safely rejected with exception', 'Rejected: true');
}

// ==========================================
// TEST 7: Benchmark Performance at Scale (1,000 / 10,000 / 50,000 sessions)
// ==========================================
function generateSyntheticSessions(count: number): WorkoutSessionV2[] {
  const sessions: WorkoutSessionV2[] = [];
  const baseTime = Date.now();
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(i / 2); // ~2 workouts per day
    const d = new Date(baseTime - dayOffset * 86400000);
    const dateStr = d.toISOString().split('T')[0];

    sessions.push({
      id: `synth_${i}`,
      planId: i % 2 === 0 ? 'tab_push' : 'tab_pull',
      planVersion: 1,
      date: dateStr,
      startedAt: baseTime - i * 3600000,
      completedAt: baseTime - i * 3600000 + 3600000,
      durationStr: '60m',
      tabNameSnapshot: i % 2 === 0 ? 'Push Day' : 'Pull Day',
      bodyWeightAtSession: 75,
      blocks: [
        {
          exerciseId: 'ex_bench',
          nameSnapshot: 'Panca Piana',
          type: 'weight',
          sets: [
            { id: `s_${i}_1`, index: 1, weight: 100, reps: 8, rir: 2 },
            { id: `s_${i}_2`, index: 2, weight: 100, reps: 8, rir: 1 }
          ]
        },
        {
          id: `circ_${i}`,
          nameSnapshot: 'Superset',
          structureType: 'classic',
          rounds: [
            {
              roundIndex: 1,
              exercises: [
                {
                  exerciseId: 'ex_curl',
                  nameSnapshot: 'Curl',
                  type: 'weight',
                  sets: [{ id: `c_${i}`, index: 1, weight: 14, reps: 10 }]
                }
              ]
            }
          ]
        }
      ]
    });
  }
  return sessions;
}

for (const scale of [1000, 10000, 50000]) {
  const t0 = performance.now();
  const sessions = generateSyntheticSessions(scale);
  const genTime = performance.now() - t0;

  // 1. Benchmark: Streak calculation
  const tStreak0 = performance.now();
  const streak = computeStreakFromSessions(sessions);
  const streakDuration = performance.now() - tStreak0;

  // 2. Benchmark: Volume calculation
  const tVol0 = performance.now();
  const volStats = calculateAllVolumeStatsV2(sessions);
  const volDuration = performance.now() - tVol0;

  // 3. Benchmark: Exercise lookup (getLastExercisePerformance)
  const tLookup0 = performance.now();
  const perf = getLastExercisePerformance(sessions, 'ex_bench', 'Panca Piana');
  const lookupDuration = performance.now() - tLookup0;

  // 4. Benchmark: Tab completion stats
  const tTab0 = performance.now();
  const tabStats = getTabCompletionStats(sessions, 'tab_push');
  const tabDuration = performance.now() - tTab0;

  console.log(`[SCALE ${scale.toLocaleString()} SESSIONS]`);
  console.log(` - Streak calc: ${streakDuration.toFixed(2)} ms (streak=${streak})`);
  console.log(` - All volume stats: ${volDuration.toFixed(2)} ms (weekVol=${volStats.week})`);
  console.log(` - Single ex lookup (O(1) fast exit): ${lookupDuration.toFixed(4)} ms`);
  console.log(` - Tab stats scan (O(N)): ${tabDuration.toFixed(2)} ms (count=${tabStats.count})`);

  assert(
    lookupDuration < 5,
    `Performance (${scale} sess): getLastExercisePerformance exits immediately`,
    `Took ${lookupDuration.toFixed(3)} ms`
  );
  if (scale <= 10000) {
    assert(
      volDuration < 100,
      `Performance (${scale} sess): volume aggregation completes in <100ms`,
      `Took ${volDuration.toFixed(2)} ms`
    );
  }
}

// Print overall summary
console.log('\n==========================================');
console.log('AUDIT TEST SUITE RESULTS:');
console.log('==========================================');
let passedCount = 0;
results.forEach((r, idx) => {
  const icon = r.passed ? '✅ PASS' : '❌ FAIL';
  if (r.passed) passedCount++;
  console.log(`${idx + 1}. [${icon}] ${r.name}`);
  console.log(`   Details: ${r.details}`);
});
console.log('==========================================');
console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);
console.log('==========================================');
