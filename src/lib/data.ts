import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  AppState,
  AppStats,
  BodyweightEntry,
  ChartPoint,
  DeloadInsight,
  Exercise,
  ExerciseLastValues,
  ExerciseProgressPoint,
  MuscleGroup,
  PersonalPattern,
  PlanExercise,
  SetEntry,
  TrainingPlan,
  TrainingSplit,
  WorkoutSession
} from "@/lib/types";

type DbExerciseMuscleGroup = {
  exercise_id: number;
  muscle_groups: MuscleGroup | null;
};

type DbPlanExercise = Omit<PlanExercise, "exercise"> & {
  exercises: Exercise | null;
};

type DbSetEntry = Omit<SetEntry, "exercise"> & {
  exercises: Exercise | null;
};

type SessionMeta = {
  rating?: number | null;
  setNotes?: Record<string, string>;
};

const DEFAULT_GROUPS = ["Brust", "Rücken", "Schulter", "Bizeps", "Trizeps", "Beine", "Bauch", "Waden", "Glutes"];

export async function getAppState(): Promise<AppState> {
  const supabase = getSupabaseAdmin();

  const [
    splitsResult,
    plansResult,
    planExercisesResult,
    exercisesResult,
    exerciseGroupsResult,
    muscleGroupsResult,
    sessionsResult,
    setsResult,
    bodyweightResult
  ] = await Promise.all([
    supabase.from("training_splits").select("*").order("sort_order", { ascending: true }),
    supabase.from("training_plans").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("plan_exercises")
      .select("id, plan_id, exercise_id, position, exercises(id, name, category)")
      .order("position", { ascending: true }),
    supabase.from("exercises").select("*").order("name", { ascending: true }),
    supabase.from("exercise_muscle_groups").select("exercise_id, muscle_groups(id, name)"),
    supabase.from("muscle_groups").select("*").order("name", { ascending: true }),
    supabase.from("workout_sessions").select("*").order("trained_on", { ascending: false }).order("id", { ascending: false }),
    supabase
      .from("set_entries")
      .select("id, session_id, exercise_id, set_number, weight_kg, reps, exercises(id, name, category)")
      .order("set_number", { ascending: true }),
    supabase.from("bodyweight_entries").select("*").order("measured_on", { ascending: true })
  ]);

  const splitTablesMissing =
    isMissingTable(splitsResult.error) || isMissingTable(exerciseGroupsResult.error) || isMissingTable(muscleGroupsResult.error);

  if (!splitTablesMissing) {
    assertNoError(splitsResult.error);
    assertNoError(exerciseGroupsResult.error);
    assertNoError(muscleGroupsResult.error);
  }

  assertNoError(plansResult.error);
  assertNoError(planExercisesResult.error);
  assertNoError(exercisesResult.error);
  assertNoError(sessionsResult.error);
  assertNoError(setsResult.error);
  assertNoError(bodyweightResult.error);

  const fallbackGroups = DEFAULT_GROUPS.map((name, index) => ({ id: index + 1, name }));
  const muscleGroups = splitTablesMissing ? fallbackGroups : ((muscleGroupsResult.data ?? []) as MuscleGroup[]);
  const exerciseGroupRows = splitTablesMissing ? [] : ((exerciseGroupsResult.data ?? []) as unknown as DbExerciseMuscleGroup[]);
  const groupsByExercise = groupBy(
    exerciseGroupRows.filter((row) => row.muscle_groups),
    (row) => row.exercise_id
  );

  const exercises = ((exercisesResult.data ?? []) as Exercise[]).map((exercise) => ({
    ...exercise,
    muscle_groups: splitTablesMissing
      ? fallbackGroups.filter((group) => group.name === exercise.category)
      : (groupsByExercise.get(exercise.id) ?? []).map((row) => row.muscle_groups as MuscleGroup)
  }));
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  const planExerciseRows = (planExercisesResult.data ?? []) as unknown as DbPlanExercise[];
  const setRows = (setsResult.data ?? []) as unknown as DbSetEntry[];

  const planExercisesByPlan = groupBy(
    planExerciseRows
      .map((row) => {
        const exercise = exerciseById.get(row.exercise_id) ?? row.exercises;

        if (!exercise) {
          return null;
        }

        return {
          id: row.id,
          plan_id: row.plan_id,
          exercise_id: row.exercise_id,
          position: row.position,
          exercise
        };
      })
      .filter(Boolean) as PlanExercise[],
    (row) => row.plan_id
  );

  const setsBySession = groupBy(
    setRows
      .map((row) => {
        const exercise = exerciseById.get(row.exercise_id) ?? row.exercises;

        if (!exercise) {
          return null;
        }

        return {
          id: row.id,
          session_id: row.session_id,
          exercise_id: row.exercise_id,
          set_number: row.set_number,
          weight_kg: Number(row.weight_kg),
          reps: row.reps,
          note: null,
          exercise
        };
      })
      .filter(Boolean) as SetEntry[],
    (row) => row.session_id
  );

  const sessions = ((sessionsResult.data ?? []) as WorkoutSession[]).map((session) => {
    const meta = parseSessionMeta(session.notes);

    return {
      ...session,
      duration_seconds: session.duration_seconds ?? 0,
      rating: normalizeRating(meta.rating),
      sets: (setsBySession.get(session.id) ?? []).map((set) => ({
        ...set,
        note: meta.setNotes?.[setNoteKey(set.exercise_id, set.set_number)] ?? null
      }))
    };
  });
  const usageByPlan = getPlanUsage(sessions);

  const plans = ((plansResult.data ?? []) as TrainingPlan[])
    .map((plan) => ({
      ...plan,
      split_id: plan.split_id ?? null,
      usage_count: usageByPlan.get(plan.id) ?? 0,
      exercises: planExercisesByPlan.get(plan.id) ?? []
    }))
    .sort((a, b) => b.usage_count - a.usage_count || a.sort_order - b.sort_order);

  const splits = splitTablesMissing ? getFallbackSplits(plans) : getSplits((splitsResult.data ?? []) as TrainingSplit[], plans);

  const bodyweight = (bodyweightResult.data ?? []) as BodyweightEntry[];
  const lastValues = getLastValues(sessions);
  const stats = getStats(sessions, bodyweight);

  return {
    splits,
    plans,
    exercises,
    muscleGroups,
    sessions,
    bodyweight,
    lastValues,
    stats
  };
}

function getSplits(splitRows: TrainingSplit[], plans: TrainingPlan[]) {
  const plansBySplit = groupBy(plans, (plan) => plan.split_id);

  return splitRows
    .map((split) => {
      const splitPlans = plansBySplit.get(split.id) ?? [];

      return {
        ...split,
        usage_count: splitPlans.reduce((sum, plan) => sum + plan.usage_count, 0),
        plans: splitPlans
      };
    })
    .sort((a, b) => b.usage_count - a.usage_count || a.sort_order - b.sort_order);
}

function getFallbackSplits(plans: TrainingPlan[]): TrainingSplit[] {
  return [
    {
      id: 0,
      name: "Meine Pläne",
      sort_order: 1,
      is_active: true,
      usage_count: plans.reduce((sum, plan) => sum + plan.usage_count, 0),
      plans
    }
  ];
}

export async function createSplit(input: { name: string; planNames: string[] }) {
  const supabase = getSupabaseAdmin();
  const splitName = input.name.trim();

  if (!splitName) {
    throw new Error("Split-Name fehlt.");
  }

  const { data: existingSplits, error: existingError } = await supabase.from("training_splits").select("id");
  assertNoError(existingError);

  const { data: split, error: splitError } = await supabase
    .from("training_splits")
    .insert({
      name: splitName,
      sort_order: (existingSplits?.length ?? 0) + 1,
      is_active: true
    })
    .select("id")
    .single();

  assertNoError(splitError);

  if (!split) {
    throw new Error("Split konnte nicht erstellt werden.");
  }

  const planRows = input.planNames
    .map((name, index) => ({ name: name.trim(), index }))
    .filter((plan) => plan.name)
    .map((plan) => ({
      split_id: split.id,
      name: plan.name,
      sort_order: plan.index + 1,
      is_active: true
    }));

  if (planRows.length > 0) {
    const { error: plansError } = await supabase.from("training_plans").insert(planRows);
    assertNoError(plansError);
  }
}

export async function createPlan(input: { splitId: number; name: string }) {
  const supabase = getSupabaseAdmin();
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error("Trainingstag fehlt.");
  }

  const { data: existingPlans, error: existingError } = await supabase
    .from("training_plans")
    .select("sort_order")
    .eq("split_id", input.splitId)
    .order("sort_order", { ascending: false })
    .limit(1);

  assertNoError(existingError);

  const { data, error } = await supabase
    .from("training_plans")
    .insert({
      split_id: input.splitId,
      name: trimmedName,
      sort_order: (existingPlans?.[0]?.sort_order ?? 0) + 1,
      is_active: true
    })
    .select("id")
    .single();

  assertNoError(error);

  if (!data) {
    throw new Error("Trainingstag konnte nicht erstellt werden.");
  }

  return data.id as number;
}

export async function addExerciseToPlan(input: { planId: number; exerciseName: string; muscleGroupIds: number[] }) {
  const supabase = getSupabaseAdmin();
  const exerciseId = await upsertExercise(input.exerciseName, input.muscleGroupIds);
  const position = await getNextPlanExercisePosition(input.planId);

  const { error } = await supabase.from("plan_exercises").insert({
    plan_id: input.planId,
    exercise_id: exerciseId,
    position
  });

  assertNoError(error);
}

export async function createPlanFromExercises(input: { splitId: number; name: string; exerciseIds: number[] }) {
  const supabase = getSupabaseAdmin();
  const planId = await createPlan({ splitId: input.splitId, name: input.name });
  const exerciseIds = [...new Set(input.exerciseIds)].filter((id) => Number.isFinite(id));

  if (exerciseIds.length === 0) {
    return planId;
  }

  const { error } = await supabase.from("plan_exercises").insert(
    exerciseIds.map((exerciseId, index) => ({
      plan_id: planId,
      exercise_id: exerciseId,
      position: index + 1
    }))
  );

  assertNoError(error);

  return planId;
}

export async function removeExerciseFromPlan(planExerciseId: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("plan_exercises").delete().eq("id", planExerciseId);
  assertNoError(error);
}

export async function createOrUpdateExercise(input: { name: string; muscleGroupIds: number[] }) {
  return upsertExercise(input.name, input.muscleGroupIds);
}

export async function createWorkout(input: {
  title: string;
  planId: number | null;
  trainedOn: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  rating?: number | null;
  exercises: {
    exerciseId: number;
    sets: {
      weight: number;
      reps: number;
      note?: string;
    }[];
  }[];
}) {
  const supabase = getSupabaseAdmin();
  const setNotes = Object.fromEntries(
    input.exercises.flatMap((exercise) =>
      exercise.sets
        .map((set, index) => [setNoteKey(exercise.exerciseId, index + 1), set.note?.trim() ?? ""] as const)
        .filter(([, note]) => note.length > 0)
    )
  );
  const rating = normalizeRating(input.rating);
  const sessionNotes = rating || Object.keys(setNotes).length > 0 ? JSON.stringify({ rating, setNotes }) : null;

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      title: input.title,
      plan_id: input.planId,
      trained_on: input.trainedOn,
      started_at: input.startedAt,
      ended_at: input.endedAt,
      duration_seconds: input.durationSeconds,
      notes: sessionNotes
    })
    .select("id")
    .single();

  assertNoError(sessionError);

  if (!session) {
    throw new Error("Training konnte nicht erstellt werden.");
  }

  const setRows = input.exercises.flatMap((exercise) =>
    exercise.sets.map((set, index) => ({
      session_id: session.id,
      exercise_id: exercise.exerciseId,
      set_number: index + 1,
      weight_kg: set.weight,
      reps: set.reps
    }))
  );

  if (setRows.length > 0) {
    const { error: setsError } = await supabase.from("set_entries").insert(setRows);
    assertNoError(setsError);
  }
}

export async function createBodyweightEntry(input: { measuredOn: string; weightKg: number }) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("bodyweight_entries").insert({
    measured_on: input.measuredOn,
    weight_kg: input.weightKg
  });

  assertNoError(error);
}

async function upsertExercise(name: string, muscleGroupIds: number[]) {
  const supabase = getSupabaseAdmin();
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Übungsname fehlt.");
  }

  const { data: existingExercise, error: findError } = await supabase
    .from("exercises")
    .select("id")
    .ilike("name", trimmedName)
    .limit(1)
    .maybeSingle();

  assertNoError(findError);

  let exerciseId = existingExercise?.id as number | undefined;

  if (!exerciseId) {
    const { data: createdExercise, error: createExerciseError } = await supabase
      .from("exercises")
      .insert({ name: trimmedName })
      .select("id")
      .single();

    assertNoError(createExerciseError);

    if (!createdExercise) {
      throw new Error("Übung konnte nicht erstellt werden.");
    }

    exerciseId = createdExercise.id;
  }

  const uniqueGroupIds = [...new Set(muscleGroupIds)].filter((id) => Number.isFinite(id));

  if (uniqueGroupIds.length > 0) {
    const { error: deleteError } = await supabase.from("exercise_muscle_groups").delete().eq("exercise_id", exerciseId);
    assertNoError(deleteError);

    const { error: groupError } = await supabase.from("exercise_muscle_groups").insert(
      uniqueGroupIds.map((groupId) => ({
        exercise_id: exerciseId,
        muscle_group_id: groupId
      }))
    );
    assertNoError(groupError);
  }

  return exerciseId;
}

async function getNextPlanExercisePosition(planId: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("plan_exercises")
    .select("position")
    .eq("plan_id", planId)
    .order("position", { ascending: false })
    .limit(1);

  assertNoError(error);

  return (data?.[0]?.position ?? 0) + 1;
}

function getPlanUsage(sessions: WorkoutSession[]) {
  const usage = new Map<number, number>();

  for (const session of sessions) {
    if (session.plan_id) {
      usage.set(session.plan_id, (usage.get(session.plan_id) ?? 0) + 1);
    }
  }

  return usage;
}

function getLastValues(sessions: WorkoutSession[]): ExerciseLastValues {
  const sortedSessions = [...sessions].sort((a, b) => b.trained_on.localeCompare(a.trained_on) || b.id - a.id);
  const lastValues: ExerciseLastValues = {};

  for (const session of sortedSessions) {
    const setsByExercise = groupBy(session.sets, (set) => set.exercise_id);

    for (const [exerciseId, sets] of setsByExercise.entries()) {
      if (lastValues[exerciseId] || sets.length === 0) {
        continue;
      }

      const firstSet = sets[0];
      lastValues[exerciseId] = {
        weight_kg: firstSet.weight_kg,
        reps: firstSet.reps,
        trained_on: session.trained_on,
        set_notes: Object.fromEntries(sets.filter((set) => set.note).map((set) => [set.set_number, set.note as string])),
        sets: [...sets]
          .sort((a, b) => a.set_number - b.set_number)
          .map((set) => ({
            set_number: set.set_number,
            weight_kg: set.weight_kg,
            reps: set.reps,
            note: set.note
          }))
      };
    }
  }

  return lastValues;
}

function parseSessionMeta(notes: string | null): SessionMeta {
  if (!notes) {
    return {};
  }

  try {
    const parsed = JSON.parse(notes) as SessionMeta;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRating(rating: number | null | undefined) {
  if (!Number.isFinite(rating)) {
    return null;
  }

  const rounded = Math.round(rating as number);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

function setNoteKey(exerciseId: number, setNumber: number) {
  return `${exerciseId}:${setNumber}`;
}

function getStats(sessions: WorkoutSession[], bodyweight: BodyweightEntry[]): AppStats {
  const sortedSessions = [...sessions].sort((a, b) => a.trained_on.localeCompare(b.trained_on));
  const totalDurationSeconds = sessions.reduce((sum, session) => sum + session.duration_seconds, 0);
  const allSets = sessions.flatMap((session) => session.sets);
  const totalVolume = allSets.reduce((sum, set) => sum + set.weight_kg * set.reps, 0);
  const totalReps = allSets.reduce((sum, set) => sum + set.reps, 0);
  const sessionScores = getSessionScores(sortedSessions);

  return {
    totalSessions: sessions.length,
    totalDurationSeconds,
    totalVolume,
    totalSets: allSets.length,
    totalReps,
    avgRepsPerSet: allSets.length > 0 ? Math.round((totalReps / allSets.length) * 10) / 10 : 0,
    volumeByDate: metricByDate(sortedSessions, (session) =>
      session.sets.reduce((sum, set) => sum + set.weight_kg * set.reps, 0)
    ),
    durationByDate: metricByDate(sortedSessions, (session) => Math.round(session.duration_seconds / 60)),
    setsByDate: metricByDate(sortedSessions, (session) => session.sets.length),
    repsByDate: metricByDate(sortedSessions, (session) => session.sets.reduce((sum, set) => sum + set.reps, 0)),
    bodyweightByDate: bodyweight.map((entry) => ({
      label: shortLabel(entry.measured_on),
      value: Number(entry.weight_kg)
    })),
    exerciseProgress: getExerciseProgress(sortedSessions),
    deloadInsight: getDeloadInsight(sessionScores, sessions.length),
    personalPatterns: getPersonalPatterns(sessionScores, sortedSessions)
  };
}

function metricByDate(sessions: WorkoutSession[], getValue: (session: WorkoutSession) => number): ChartPoint[] {
  return sessions.slice(-8).map((session) => ({
    label: shortLabel(session.trained_on),
    value: getValue(session)
  }));
}

type SessionScore = {
  session: WorkoutSession;
  volume: number;
  sets: number;
  reps: number;
  volumePerSet: number;
  weekday: string;
  durationMinutes: number;
};

function getSessionScores(sessions: WorkoutSession[]): SessionScore[] {
  return sessions
    .map((session) => {
      const volume = session.sets.reduce((sum, set) => sum + set.weight_kg * set.reps, 0);
      const sets = session.sets.length;
      const reps = session.sets.reduce((sum, set) => sum + set.reps, 0);

      return {
        session,
        volume,
        sets,
        reps,
        volumePerSet: sets > 0 ? volume / sets : 0,
        weekday: weekdayLong(session.trained_on),
        durationMinutes: Math.round(session.duration_seconds / 60)
      };
    })
    .filter((score) => score.sets > 0);
}

function getDeloadInsight(scores: SessionScore[], totalSessions: number): DeloadInsight {
  if (scores.length < 4) {
    const missing = Math.max(0, 4 - scores.length);

    return {
      status: "learning",
      title: "Deload-Frühwarnung lernt noch",
      message:
        totalSessions > scores.length
          ? "Einige Trainings haben noch keine echten Sätze. Für eine Warnung brauche ich mehr sauber getrackte Einheiten."
          : "Noch zu wenig echte Trainingsdaten, um fair zu beurteilen, ob du nur müde bist oder wirklich stagnierst.",
      action: missing > 0 ? `Tracke noch ${missing} echte Trainings mit Sätzen.` : "Tracke weiter normal.",
      scoreLabel: `${scores.length}/4`
    };
  }

  const recent = scores.slice(-3);
  const previous = scores.slice(-6, -3);
  const recentAverage = average(recent.map((score) => score.volumePerSet));
  const previousAverage = average(previous.map((score) => score.volumePerSet));
  const recentRatings = recent.map((score) => score.session.rating).filter((rating): rating is number => Boolean(rating));
  const avgRecentRating = recentRatings.length > 0 ? average(recentRatings) : null;
  const dropPercent = previousAverage > 0 ? Math.round(((previousAverage - recentAverage) / previousAverage) * 100) : 0;

  if (previousAverage > 0 && dropPercent >= 15 && (avgRecentRating === null || avgRecentRating <= 3.5)) {
    return {
      status: "deload",
      title: "Deload wahrscheinlich sinnvoll",
      message: `Deine letzten 3 Trainings liegen ca. ${dropPercent}% unter dem vorherigen Niveau pro Satz.`,
      action: "Plane 1-2 leichtere Einheiten: weniger Sätze, keine Max-Versuche, saubere Technik.",
      scoreLabel: `-${dropPercent}%`
    };
  }

  if (previousAverage > 0 && dropPercent >= 8) {
    return {
      status: "watch",
      title: "Erholung beobachten",
      message: `Die Leistung fällt leicht ab (${dropPercent}% pro Satz). Das ist noch kein Problem, aber ein Signal.`,
      action: "Halte das Gewicht heute eher stabil und achte darauf, ob sich das noch 1-2 Trainings fortsetzt.",
      scoreLabel: `-${dropPercent}%`
    };
  }

  return {
    status: "ready",
    title: "Kein Deload-Signal",
    message: "Deine letzten Trainings sehen stabil genug aus. Kein klares Zeichen, dass du aktiv rausnehmen musst.",
    action: "Trainiere normal weiter und steigere nur, wenn die Sätze sauber bleiben.",
    scoreLabel: "stabil"
  };
}

function getPersonalPatterns(scores: SessionScore[], sessions: WorkoutSession[]): PersonalPattern[] {
  if (scores.length < 3) {
    return [
      {
        title: "Muster brauchen mehr Daten",
        message: "Ich erkenne noch keine belastbaren persönlichen Muster.",
        detail: "Tracke ein paar echte Einheiten. Danach zeigt die App, an welchen Tagen, Dauern oder Übungen du besonders stark bist."
      }
    ];
  }

  const patterns: PersonalPattern[] = [];
  const weekdayGroups = groupBy(scores, (score) => score.weekday);
  const bestWeekday = bestGroupAverage(weekdayGroups, (score) => score.volumePerSet);

  if (bestWeekday) {
    patterns.push({
      title: "Stärkster Trainingstag",
      message: `Deine beste Leistung pro Satz kommt aktuell am ${bestWeekday.label}.`,
      detail: `${Math.round(bestWeekday.average)} kg Volumen pro Satz im Schnitt.`
    });
  }

  const durationGroups = groupBy(
    scores,
    (score) => (score.durationMinutes < 45 ? "kurze Trainings" : score.durationMinutes <= 75 ? "mittlere Trainings" : "lange Trainings")
  );
  const bestDuration = bestGroupAverage(durationGroups, (score) => score.volumePerSet);

  if (bestDuration) {
    patterns.push({
      title: "Beste Trainingslänge",
      message: `Bei dir wirken aktuell ${bestDuration.label} am stärksten.`,
      detail: `${Math.round(bestDuration.average)} kg Volumen pro Satz. Später kann WHOOP hier Schlaf und Recovery dazulegen.`
    });
  }

  const progress = getBestExercisePattern(sessions);

  if (progress) {
    patterns.push(progress);
  }

  return patterns.slice(0, 3);
}

function getBestExercisePattern(sessions: WorkoutSession[]): PersonalPattern | null {
  const strongestByExercise = new Map<number, { name: string; values: { date: string; weight: number }[] }>();

  for (const session of sessions) {
    const strongestInSession = new Map<number, { name: string; weight: number }>();

    for (const set of session.sets) {
      const current = strongestInSession.get(set.exercise_id);

      if (!current || current.weight < set.weight_kg) {
        strongestInSession.set(set.exercise_id, { name: set.exercise.name, weight: set.weight_kg });
      }
    }

    for (const [exerciseId, value] of strongestInSession.entries()) {
      const current = strongestByExercise.get(exerciseId) ?? { name: value.name, values: [] };
      strongestByExercise.set(exerciseId, {
        name: current.name,
        values: [...current.values, { date: session.trained_on, weight: value.weight }]
      });
    }
  }

  const improvements = [...strongestByExercise.values()]
    .map((exercise) => {
      const values = exercise.values.sort((a, b) => a.date.localeCompare(b.date));
      const first = values[0];
      const latest = values.at(-1);

      return first && latest && values.length >= 2
        ? {
            name: exercise.name,
            improvement: latest.weight - first.weight,
            latest: latest.weight
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b?.improvement ?? 0) - (a?.improvement ?? 0));

  const best = improvements[0];

  if (!best || best.improvement <= 0) {
    return null;
  }

  return {
    title: "Beste Übungsentwicklung",
    message: `${best.name} entwickelt sich aktuell am besten.`,
    detail: `Stärkster Satz ist um ${formatKg(best.improvement)} kg gestiegen, zuletzt ${formatKg(best.latest)} kg.`
  };
}

function bestGroupAverage<T>(groups: Map<string, T[]>, getValue: (item: T) => number) {
  return [...groups.entries()]
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({
      label,
      average: average(items.map(getValue))
    }))
    .sort((a, b) => b.average - a.average)[0];
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function getExerciseProgress(sessions: WorkoutSession[]): ExerciseProgressPoint[] {
  const strongestBySession = new Map<string, ExerciseProgressPoint>();

  for (const session of sessions) {
    for (const set of session.sets) {
      const key = `${set.exercise_id}-${session.trained_on}`;
      const current = strongestBySession.get(key);

      if (!current || current.value < set.weight_kg) {
        strongestBySession.set(key, {
          exerciseId: set.exercise_id,
          exerciseName: set.exercise.name,
          label: shortLabel(session.trained_on),
          value: set.weight_kg
        });
      }
    }
  }

  return [...strongestBySession.values()].slice(-12);
}

function shortLabel(date: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(date));
}

function weekdayLong(date: string) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long"
  }).format(new Date(date));
}

function formatKg(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function groupBy<T, K>(items: T[], getKey: (item: T) => K) {
  const grouped = new Map<K, T[]>();

  for (const item of items) {
    const key = getKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return grouped;
}

function assertNoError(error: unknown) {
  if (error) {
    throw error;
  }
}

function isMissingTable(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "PGRST205");
}

export { DEFAULT_GROUPS };
