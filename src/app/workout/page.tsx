"use client";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Dumbbell,
  Layers3,
  Lock,
  LogOut,
  Plus,
  Settings2,
  TimerReset,
  Trash2,
  Trophy,
  Weight,
  X
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { demoState } from "@/lib/demo-data";
import { formatDuration, formatMonth, formatTimer, weekdayShort } from "@/lib/format";
import type { ActiveExercise, AppState, ChartPoint, Exercise, MuscleGroup, SetEntry, TrainingPlan, TrainingSplit, WorkoutSession } from "@/lib/types";

type Tab = "diary" | "plans" | "stats";
type StartStep = "split" | "plan";
type PlansStep = "splits" | "days" | "exercises";

type ActiveWorkout = {
  planId: number | null;
  title: string;
  startedAt: string;
  exercises: ActiveExercise[];
};

type StoredActiveWorkout = {
  workout: ActiveWorkout;
  rating: number;
};

type SuggestedTraining = {
  split: TrainingSplit;
  plan: TrainingPlan;
};

type ExerciseDraft = {
  name: string;
  muscleGroupIds: number[];
};

const accent = "#62dbe6";
const activeWorkoutStorageKey = "active-workout-draft-v1";

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [state, setState] = useState<AppState>(demoState);
  const [isDemo, setIsDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("diary");
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [workoutRating, setWorkoutRating] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [bodyweightDraft, setBodyweightDraft] = useState("");
  const [startOpen, setStartOpen] = useState(false);
  const [startStep, setStartStep] = useState<StartStep>("split");
  const [selectedStartSplit, setSelectedStartSplit] = useState<TrainingSplit | null>(null);
  const [splitName, setSplitName] = useState("");
  const [splitDays, setSplitDays] = useState("Push, Pull");
  const [dayDrafts, setDayDrafts] = useState<Record<number, string>>({});
  const [planExerciseDrafts, setPlanExerciseDrafts] = useState<Record<number, ExerciseDraft>>({});
  const [exerciseSettingsOpen, setExerciseSettingsOpen] = useState<Partial<Record<number | "active", boolean>>>({});
  const [activeExerciseDraft, setActiveExerciseDraft] = useState<ExerciseDraft>({ name: "", muscleGroupIds: [] });
  const [plansStep, setPlansStep] = useState<PlansStep>("splits");
  const [selectedSplitId, setSelectedSplitId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/session");
        const session = (await response.json()) as { unlocked: boolean };
        setUnlocked(session.unlocked);

        if (session.unlocked) {
          await refreshState();
        }
      } catch {
        setIsDemo(true);
      } finally {
        setIsLoading(false);
      }
    }

    void checkSession();
  }, []);

  useEffect(() => {
    if (!activeWorkout) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - new Date(activeWorkout.startedAt).getTime()) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeWorkout]);

  useEffect(() => {
    if (isLoading || !unlocked || activeWorkout) {
      return;
    }

    const storedDraft = readStoredActiveWorkout();

    if (!storedDraft) {
      return;
    }

    const restoreFrame = window.requestAnimationFrame(() => {
      setActiveWorkout(storedDraft.workout);
      setWorkoutRating(storedDraft.rating);
      setElapsedSeconds(Math.floor((Date.now() - new Date(storedDraft.workout.startedAt).getTime()) / 1000));
    });

    return () => window.cancelAnimationFrame(restoreFrame);
  }, [activeWorkout, isLoading, unlocked]);

  useEffect(() => {
    if (isLoading || !unlocked) {
      return;
    }

    if (!activeWorkout) {
      window.localStorage.removeItem(activeWorkoutStorageKey);
      return;
    }

    window.localStorage.setItem(
      activeWorkoutStorageKey,
      JSON.stringify({
        workout: activeWorkout,
        rating: workoutRating
      } satisfies StoredActiveWorkout)
    );
  }, [activeWorkout, isLoading, unlocked, workoutRating]);

  async function refreshState() {
    const response = await fetch("/api/state");

    if (!response.ok) {
      setIsDemo(true);
      return;
    }

    const nextState = (await response.json()) as AppState;
    setState(nextState);
    setIsDemo(false);
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnlockError("");

    const response = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode })
    });

    if (!response.ok) {
      setUnlockError("Der Code passt nicht.");
      return;
    }

    setUnlocked(true);
    await refreshState();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.localStorage.removeItem(activeWorkoutStorageKey);
    setActiveWorkout(null);
    setUnlocked(false);
  }

  async function saveRequest(url: string, payload: unknown) {
    setSaving(true);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Speichern fehlgeschlagen.");
      }

      await refreshState();
      return response;
    } finally {
      setSaving(false);
    }
  }

  async function createSplit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const planNames = splitDays
      .split(",")
      .map((day) => day.trim())
      .filter(Boolean);

    await saveRequest("/api/splits", { name: splitName, planNames });
    setSplitName("");
    setSplitDays("Push, Pull");
  }

  async function createPlanDay(splitId: number) {
    const name = dayDrafts[splitId]?.trim();

    if (!name) {
      return;
    }

    await saveRequest("/api/plans", { action: "create-day", splitId, name });
    setDayDrafts((drafts) => ({ ...drafts, [splitId]: "" }));
  }

  async function addPlanExercise(planId: number) {
    const draft = planExerciseDrafts[planId] ?? emptyDraft();

    if (!draft.name.trim()) {
      return;
    }

    await saveRequest("/api/plans", {
      action: "add-exercise",
      planId,
      exerciseName: draft.name,
      muscleGroupIds: draft.muscleGroupIds
    });
    setPlanExerciseDrafts((drafts) => ({ ...drafts, [planId]: emptyDraft() }));
  }

  async function saveSessionAsPlan(session: WorkoutSession, splitId: number, name: string) {
    const exerciseIds = getSessionExerciseIds(session);

    if (exerciseIds.length === 0) {
      throw new Error("Dieses Training hat keine Übungen zum Speichern.");
    }

    const response = await saveRequest("/api/plans", {
      action: "create-day-from-session",
      splitId,
      name,
      exerciseIds
    });
    const result = (await response?.json()) as { planId?: number } | undefined;

    setTab("plans");
    setPlansStep("exercises");
    setSelectedSplitId(splitId);
    setSelectedPlanId(result?.planId ?? null);
    setSelectedSessionId(null);
  }

  async function removePlanExercise(planExerciseId: number) {
    await saveRequest("/api/plans", { action: "remove-exercise", planExerciseId });
  }

  async function addBodyweight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weightKg = Number(bodyweightDraft.replace(",", "."));

    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      return;
    }

    await saveRequest("/api/bodyweight", {
      measuredOn: new Date().toISOString().slice(0, 10),
      weightKg
    });
    setBodyweightDraft("");
  }

  function openStartFlow() {
    setSelectedStartSplit(null);
    setStartStep("split");
    setStartOpen(true);
  }

  function startWorkout(plan?: TrainingPlan) {
    const now = new Date().toISOString();
    const fallbackExercise = state.exercises[0];
    const exercises =
      plan?.exercises.map((planExercise) => ({
        exerciseId: planExercise.exercise.id,
        name: planExercise.exercise.name,
        muscleGroups: planExercise.exercise.muscle_groups,
        sets: [{ weight: "", reps: "", note: "" }]
      })) ??
      (fallbackExercise
        ? [{ exerciseId: fallbackExercise.id, name: fallbackExercise.name, muscleGroups: fallbackExercise.muscle_groups, sets: [{ weight: "", reps: "", note: "" }] }]
        : []);

    setActiveWorkout({
      planId: plan?.id ?? null,
      title: plan?.name ?? "Freies Training",
      startedAt: now,
      exercises
    });
    setElapsedSeconds(0);
    setWorkoutRating(0);
    setStartOpen(false);
  }

  function updateSet(exerciseIndex: number, setIndex: number, field: "weight" | "reps" | "note", value: string) {
    setSaveError("");
    setActiveWorkout((workout) => {
      if (!workout) {
        return workout;
      }

      return {
        ...workout,
        exercises: workout.exercises.map((exercise, currentExerciseIndex) =>
          currentExerciseIndex === exerciseIndex
            ? {
                ...exercise,
                sets: exercise.sets.map((set, currentSetIndex) =>
                  currentSetIndex === setIndex ? { ...set, [field]: value } : set
                )
              }
            : exercise
        )
      };
    });
  }

  function addSet(exerciseIndex: number) {
    setActiveWorkout((workout) => {
      if (!workout) {
        return workout;
      }

      return {
        ...workout,
        exercises: workout.exercises.map((exercise, currentIndex) =>
          currentIndex === exerciseIndex ? { ...exercise, sets: [...exercise.sets, { weight: "", reps: "", note: "" }] } : exercise
        )
      };
    });
  }

  function copySet(exerciseIndex: number, setIndex: number) {
    setActiveWorkout((workout) => {
      if (!workout) {
        return workout;
      }

      return {
        ...workout,
        exercises: workout.exercises.map((exercise, currentIndex) => {
          if (currentIndex !== exerciseIndex) {
            return exercise;
          }

          const copiedSet = exercise.sets[setIndex];
          return {
            ...exercise,
            sets: [...exercise.sets.slice(0, setIndex + 1), { ...copiedSet }, ...exercise.sets.slice(setIndex + 1)]
          };
        })
      };
    });
  }

  function applyLastWorkoutValues(exerciseIndex: number) {
    setActiveWorkout((workout) => {
      if (!workout) {
        return workout;
      }

      return {
        ...workout,
        exercises: workout.exercises.map((exercise, currentIndex) => {
          if (currentIndex !== exerciseIndex) {
            return exercise;
          }

          const lastSets = getLastSets(state.lastValues[exercise.exerciseId]);

          if (lastSets.length === 0) {
            return exercise;
          }

          const nextSets = Array.from({ length: Math.max(exercise.sets.length, lastSets.length) }, (_, setIndex) => {
            const currentSet = exercise.sets[setIndex] ?? { weight: "", reps: "", note: "" };
            const lastSet = lastSets[setIndex] ?? lastSets.at(-1);

            return lastSet
              ? {
                  ...currentSet,
                  weight: formatNumber(lastSet.weight_kg),
                  reps: String(lastSet.reps)
                }
              : currentSet;
          });

          return { ...exercise, sets: nextSets };
        })
      };
    });
  }

  function applyLastSetValues(exerciseIndex: number, setIndex: number) {
    setActiveWorkout((workout) => {
      if (!workout) {
        return workout;
      }

      return {
        ...workout,
        exercises: workout.exercises.map((exercise, currentExerciseIndex) => {
          if (currentExerciseIndex !== exerciseIndex) {
            return exercise;
          }

          const lastSets = getLastSets(state.lastValues[exercise.exerciseId]);
          const lastSet = lastSets[setIndex] ?? lastSets.at(-1);

          if (!lastSet) {
            return exercise;
          }

          return {
            ...exercise,
            sets: exercise.sets.map((set, currentSetIndex) =>
              currentSetIndex === setIndex
                ? {
                    ...set,
                    weight: formatNumber(lastSet.weight_kg),
                    reps: String(lastSet.reps)
                  }
                : set
            )
          };
        })
      };
    });
  }

  function bumpSetValue(exerciseIndex: number, setIndex: number, field: "weight" | "reps", amount: number) {
    setActiveWorkout((workout) => {
      if (!workout) {
        return workout;
      }

      return {
        ...workout,
        exercises: workout.exercises.map((exercise, currentExerciseIndex) => {
          if (currentExerciseIndex !== exerciseIndex) {
            return exercise;
          }

          const lastSets = getLastSets(state.lastValues[exercise.exerciseId]);
          const lastSet = lastSets[setIndex] ?? lastSets.at(-1);

          return {
            ...exercise,
            sets: exercise.sets.map((set, currentSetIndex) => {
              if (currentSetIndex !== setIndex) {
                return set;
              }

              const fallback = field === "weight" ? lastSet?.weight_kg : lastSet?.reps;
              const rawValue = field === "weight" ? set.weight : set.reps;
              const currentValue = Number(rawValue.replace(",", "."));
              const baseValue = Number.isFinite(currentValue) ? currentValue : (fallback ?? 0);
              const nextValue = field === "weight" ? Math.max(0, baseValue + amount) : Math.max(1, Math.round(baseValue + amount));

              return {
                ...set,
                [field]: formatNumber(nextValue)
              };
            })
          };
        })
      };
    });
  }

  function discardActiveWorkout() {
    window.localStorage.removeItem(activeWorkoutStorageKey);
    setActiveWorkout(null);
    setWorkoutRating(0);
    setElapsedSeconds(0);
  }

  function removeActiveExercise(exerciseIndex: number) {
    setActiveWorkout((workout) => {
      if (!workout) {
        return workout;
      }

      return {
        ...workout,
        exercises: workout.exercises.filter((_, currentIndex) => currentIndex !== exerciseIndex)
      };
    });
  }

  async function addActiveExercise() {
    const exercise = await ensureExercise(activeExerciseDraft);

    if (!exercise) {
      return;
    }

    setActiveWorkout((workout) =>
      workout
        ? {
            ...workout,
            exercises: [...workout.exercises, { exerciseId: exercise.id, name: exercise.name, muscleGroups: exercise.muscle_groups, sets: [{ weight: "", reps: "", note: "" }] }]
          }
        : workout
    );
    setActiveExerciseDraft(emptyDraft());
  }

  async function ensureExercise(draft: ExerciseDraft): Promise<Exercise | null> {
    const existing = findExercise(state.exercises, draft.name);

    if (existing) {
      return existing;
    }

    if (!draft.name.trim()) {
      return null;
    }

    const response = await saveRequest("/api/exercises", { name: draft.name, muscleGroupIds: draft.muscleGroupIds });
    const result = (await response?.json()) as { id?: number } | undefined;
    const refreshed = await fetch("/api/state").then((res) => res.json() as Promise<AppState>);
    setState(refreshed);

    return refreshed.exercises.find((exercise) => exercise.id === result?.id) ?? findExercise(refreshed.exercises, draft.name) ?? null;
  }

  async function finishWorkout() {
    if (!activeWorkout) {
      return;
    }

    setSaveError("");
    const endedAt = new Date().toISOString();
    const exercises = getValidWorkoutExercises(activeWorkout);

    if (exercises.length === 0) {
      setSaveError("Trage mindestens einen Satz mit Wiederholungen ein.");
      return;
    }

    try {
      await saveRequest("/api/workouts", {
        title: activeWorkout.title,
        planId: activeWorkout.planId,
        trainedOn: endedAt.slice(0, 10),
        startedAt: activeWorkout.startedAt,
        endedAt,
        durationSeconds: Math.max(60, elapsedSeconds),
        rating: workoutRating,
        exercises
      });

      window.localStorage.removeItem(activeWorkoutStorageKey);
      setActiveWorkout(null);
      setWorkoutRating(0);
      setTab("diary");
    } catch {
      setSaveError("Training konnte nicht gespeichert werden. Bitte versuch es nochmal.");
    }
  }

  const groupedSessions = useMemo(() => groupSessionsByMonth(state.sessions), [state.sessions]);
  const suggestedTraining = useMemo(() => getSuggestedTraining(state.splits, state.sessions), [state.splits, state.sessions]);
  const canFinishWorkout = activeWorkout ? getValidWorkoutExercises(activeWorkout).length > 0 : false;
  const selectedSession = selectedSessionId ? state.sessions.find((session) => session.id === selectedSessionId) ?? null : null;

  if (isLoading) {
    return (
      <main className="app-shell dashboard-fitness-shell auth-shell">
        <DashboardPortalHeader />
        <div className="loader-card">Lade deine Trainingsapp...</div>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <main className="app-shell dashboard-fitness-shell auth-shell">
        <DashboardPortalHeader />
        <section className="unlock-card">
          <div className="lock-icon">
            <Lock size={28} />
          </div>
          <h1>Workout Tracker</h1>
          <p>Gib deinen privaten App-Code ein. Danach öffnet sich dein Trainingstagebuch.</p>
          <form onSubmit={unlock}>
            <input
              aria-label="App-Code"
              autoFocus
              inputMode="numeric"
              placeholder="App-Code"
              type="password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
            />
            <button type="submit">Öffnen</button>
          </form>
          {unlockError ? <span className="error-text">{unlockError}</span> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell dashboard-fitness-shell">
      <DashboardPortalHeader />
      <header className="top-bar">
        <div>
          <span className="mini-label">{isDemo ? "Demo-Daten" : "Private Cloud"}</span>
          <h1>{activeWorkout ? "Aktives Training" : selectedSession ? "Training" : tabTitle(tab)}</h1>
        </div>
        <div className="top-actions">
          {!activeWorkout ? (
            <button className="icon-button" type="button" aria-label="Training starten" onClick={openStartFlow}>
              <Plus size={26} />
            </button>
          ) : null}
          <button className="icon-button muted" type="button" aria-label="Abmelden" onClick={logout}>
            <LogOut size={21} />
          </button>
        </div>
      </header>
      {!activeWorkout && !selectedSession ? <FitnessTopNav tab={tab} setTab={setTab} /> : null}

      {activeWorkout ? (
        <ActiveWorkoutView
          activeWorkout={activeWorkout}
          elapsedSeconds={elapsedSeconds}
          finishWorkout={finishWorkout}
          discardActiveWorkout={discardActiveWorkout}
          addSet={addSet}
          copySet={copySet}
          applyLastWorkoutValues={applyLastWorkoutValues}
          applyLastSetValues={applyLastSetValues}
          bumpSetValue={bumpSetValue}
          updateSet={updateSet}
          removeActiveExercise={removeActiveExercise}
          addActiveExercise={addActiveExercise}
          activeExerciseDraft={activeExerciseDraft}
          setActiveExerciseDraft={setActiveExerciseDraft}
          exerciseSettingsOpen={exerciseSettingsOpen}
          setExerciseSettingsOpen={setExerciseSettingsOpen}
          exercises={state.exercises}
          muscleGroups={state.muscleGroups}
          lastValues={state.lastValues}
          workoutRating={workoutRating}
          setWorkoutRating={setWorkoutRating}
          canFinish={canFinishWorkout}
          saveError={saveError}
          saving={saving}
        />
      ) : (
        <>
          {selectedSession ? (
            <SessionDetailView
              session={selectedSession}
              splits={state.splits}
              onBack={() => setSelectedSessionId(null)}
              onSaveAsPlan={saveSessionAsPlan}
              saving={saving}
            />
          ) : null}
          {!selectedSession && tab === "diary" ? (
            <DiaryView
              groupedSessions={groupedSessions}
              suggestedTraining={suggestedTraining}
              startWorkout={openStartFlow}
              startSuggestedWorkout={startWorkout}
              openSession={(sessionId) => setSelectedSessionId(sessionId)}
            />
          ) : null}
          {!selectedSession && tab === "plans" ? (
            <PlansView
              state={state}
              splitName={splitName}
              setSplitName={setSplitName}
              splitDays={splitDays}
              setSplitDays={setSplitDays}
              createSplit={createSplit}
              dayDrafts={dayDrafts}
              setDayDrafts={setDayDrafts}
              createPlanDay={createPlanDay}
              planExerciseDrafts={planExerciseDrafts}
              setPlanExerciseDrafts={setPlanExerciseDrafts}
              exerciseSettingsOpen={exerciseSettingsOpen}
              setExerciseSettingsOpen={setExerciseSettingsOpen}
              plansStep={plansStep}
              setPlansStep={setPlansStep}
              selectedSplitId={selectedSplitId}
              setSelectedSplitId={setSelectedSplitId}
              selectedPlanId={selectedPlanId}
              setSelectedPlanId={setSelectedPlanId}
              addPlanExercise={addPlanExercise}
              removePlanExercise={removePlanExercise}
              saving={saving}
            />
          ) : null}
          {!selectedSession && tab === "stats" ? (
            <StatsView state={state} bodyweightDraft={bodyweightDraft} setBodyweightDraft={setBodyweightDraft} addBodyweight={addBodyweight} />
          ) : null}
        </>
      )}

      <DashboardBottomNav />
      {startOpen ? (
        <StartWorkoutModal
          step={startStep}
          setStep={setStartStep}
          splits={state.splits}
          selectedSplit={selectedStartSplit}
          setSelectedSplit={setSelectedStartSplit}
          startWorkout={startWorkout}
          onClose={() => setStartOpen(false)}
        />
      ) : null}
    </main>
  );
}

function DashboardPortalHeader() {
  return (
    <nav className="dashboard-portal-nav" aria-label="Dashboard-Navigation">
      <Link href="/index.html">
        <ArrowLeft size={17} />
        Dashboard
      </Link>
      <span>Fitness</span>
    </nav>
  );
}

function DashboardBottomNav() {
  return (
    <nav className="dashboard-bottom-nav" aria-label="Hauptnavigation">
      <Link href="/index.html" className="dashboard-bottom-tab">
        <span className="dashboard-bottom-icon" aria-hidden="true">🏠</span>
        <span>Start</span>
      </Link>
      <Link href="/health.html" className="dashboard-bottom-tab">
        <span className="dashboard-bottom-icon" aria-hidden="true">💊</span>
        <span>Gesundheit</span>
      </Link>
      <Link href="/workout" className="dashboard-bottom-tab active" aria-current="page">
        <span className="dashboard-bottom-icon" aria-hidden="true">💪</span>
        <span>Fitness</span>
      </Link>
    </nav>
  );
}

function DiaryView({
  groupedSessions,
  suggestedTraining,
  startWorkout,
  startSuggestedWorkout,
  openSession
}: {
  groupedSessions: Map<string, WorkoutSession[]>;
  suggestedTraining: SuggestedTraining | null;
  startWorkout: () => void;
  startSuggestedWorkout: (plan?: TrainingPlan) => void;
  openSession: (sessionId: number) => void;
}) {
  return (
    <section className="screen-content">
      {suggestedTraining ? (
        <article className="quick-start-card">
          <span className="mini-label">Nächstes Training</span>
          <h2>{suggestedTraining.plan.name}</h2>
          <p>
            {suggestedTraining.split.name} · {suggestedTraining.plan.exercises.length} Übungen
          </p>
          <div className="quick-start-actions">
            <button className="primary-action" type="button" onClick={() => startSuggestedWorkout(suggestedTraining.plan)}>
              <TimerReset size={20} />
              Jetzt starten
            </button>
            <button className="outline-action" type="button" onClick={startWorkout}>
              Anderes Training
            </button>
          </div>
        </article>
      ) : (
        <button className="primary-action" type="button" onClick={startWorkout}>
          <TimerReset size={20} />
          Training starten
        </button>
      )}

      {[...groupedSessions.entries()].map(([month, sessions]) => (
        <div className="month-group" key={month}>
          <div className="section-heading">
            <h2>{month}</h2>
            <span>
              {sessions.length} {sessions.length === 1 ? "Training" : "Trainings"}
            </span>
          </div>
          <div className="stack-card">
            {sessions.map((session) => (
              <button className="diary-row" type="button" key={session.id} onClick={() => openSession(session.id)}>
                <div className="date-badge">
                  <span>{weekdayShort(session.trained_on)}</span>
                  <strong>{new Date(session.trained_on).getDate()}</strong>
                </div>
                <div className="diary-main">
                  <h3>{session.title}</h3>
                  {session.rating ? <span className="diary-rating">{renderStars(session.rating)}</span> : null}
                  {summarizeSession(session).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <span className="duration">{formatDuration(session.duration_seconds)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function SessionDetailView({
  session,
  splits,
  onBack,
  onSaveAsPlan,
  saving
}: {
  session: WorkoutSession;
  splits: TrainingSplit[];
  onBack: () => void;
  onSaveAsPlan: (session: WorkoutSession, splitId: number, name: string) => Promise<void>;
  saving: boolean;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [splitId, setSplitId] = useState<number | null>(splits[0]?.id ?? null);
  const [name, setName] = useState(session.title);
  const [error, setError] = useState("");
  const setsByExercise = groupSessionSets(session);
  const totalVolume = session.sets.reduce((sum, set) => sum + set.weight_kg * set.reps, 0);

  async function submitPlan() {
    setError("");

    if (!splitId || !name.trim()) {
      setError("Wähle einen Split und gib einen Namen ein.");
      return;
    }

    try {
      await onSaveAsPlan(session, splitId, name.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Der Trainingstag konnte nicht gespeichert werden.");
    }
  }

  return (
    <section className="screen-content session-detail">
      <EditorHeader title={session.title} subtitle={`${formatDateLong(session.trained_on)} · ${formatDuration(session.duration_seconds)}`} onBack={onBack} />

      <div className="session-summary-grid">
        <MetricPill label="Übungen" value={setsByExercise.length} />
        <MetricPill label="Sätze" value={session.sets.length} />
        <MetricPill label="Volumen" value={`${Math.round(totalVolume)} kg`} />
        <MetricPill label="Gefühl" value={session.rating ? renderStars(session.rating) : "-"} />
      </div>

      <article className="editor-panel">
        <div className="panel-heading">
          <h2>Als Trainingstag speichern</h2>
          <span>Die Übungen aus diesem Training werden als neuer Tag in deinem Split abgelegt.</span>
        </div>
        {saveOpen ? (
          <div className="save-plan-box">
            <input placeholder="Name, z. B. Push" value={name} onChange={(event) => setName(event.target.value)} />
            <select value={splitId ?? ""} onChange={(event) => setSplitId(Number(event.target.value))}>
              {splits.map((split) => (
                <option key={split.id} value={split.id}>
                  {split.name}
                </option>
              ))}
            </select>
            {error ? <p className="save-error left">{error}</p> : null}
            <div className="dual-actions">
              <button type="button" onClick={submitPlan} disabled={saving}>
                Speichern
              </button>
              <button className="danger-action" type="button" onClick={() => setSaveOpen(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <button className="secondary-action" type="button" onClick={() => setSaveOpen(true)}>
            Als Trainingstag speichern
          </button>
        )}
      </article>

      {setsByExercise.map(({ exercise, sets }) => (
        <article className="tracking-card" key={exercise.id}>
          <div className="session-exercise-heading">
            <div>
              <h2>{exercise.name}</h2>
              <MuscleChips groups={exercise.muscle_groups} />
            </div>
            <span>{sets.length} Sätze</span>
          </div>
          <div className="completed-set-list">
            {sets.map((set) => (
              <div className="completed-set-row" key={set.id}>
                <strong>Satz {set.set_number}</strong>
                <span>{formatNumber(set.weight_kg)} kg</span>
                <span>{set.reps} Wdh.</span>
                {set.note ? <p>{set.note}</p> : null}
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}


function PlansView({
  state,
  splitName,
  setSplitName,
  splitDays,
  setSplitDays,
  createSplit,
  dayDrafts,
  setDayDrafts,
  createPlanDay,
  planExerciseDrafts,
  setPlanExerciseDrafts,
  exerciseSettingsOpen,
  setExerciseSettingsOpen,
  plansStep,
  setPlansStep,
  selectedSplitId,
  setSelectedSplitId,
  selectedPlanId,
  setSelectedPlanId,
  addPlanExercise,
  removePlanExercise,
  saving
}: {
  state: AppState;
  splitName: string;
  setSplitName: (value: string) => void;
  splitDays: string;
  setSplitDays: (value: string) => void;
  createSplit: (event: FormEvent<HTMLFormElement>) => void;
  dayDrafts: Record<number, string>;
  setDayDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  createPlanDay: (splitId: number) => void;
  planExerciseDrafts: Record<number, ExerciseDraft>;
  setPlanExerciseDrafts: React.Dispatch<React.SetStateAction<Record<number, ExerciseDraft>>>;
  exerciseSettingsOpen: Partial<Record<number | "active", boolean>>;
  setExerciseSettingsOpen: React.Dispatch<React.SetStateAction<Partial<Record<number | "active", boolean>>>>;
  plansStep: PlansStep;
  setPlansStep: (step: PlansStep) => void;
  selectedSplitId: number | null;
  setSelectedSplitId: (id: number | null) => void;
  selectedPlanId: number | null;
  setSelectedPlanId: (id: number | null) => void;
  addPlanExercise: (planId: number) => void;
  removePlanExercise: (planExerciseId: number) => void;
  saving: boolean;
}) {
  const selectedSplit = state.splits.find((split) => split.id === selectedSplitId) ?? null;
  const selectedPlan = selectedSplit?.plans.find((plan) => plan.id === selectedPlanId) ?? null;

  if (plansStep === "days" && selectedSplit) {
    return (
      <section className="screen-content">
        <EditorHeader
          title={selectedSplit.name}
          subtitle={`${selectedSplit.plans.length} Trainingstage · ${selectedSplit.usage_count} Starts`}
          onBack={() => {
            setPlansStep("splits");
            setSelectedSplitId(null);
            setSelectedPlanId(null);
          }}
        />

        <div className="inline-form">
          <input
            placeholder="Trainingstag hinzufügen, z. B. Push"
            value={dayDrafts[selectedSplit.id] ?? ""}
            onChange={(event) => setDayDrafts((drafts) => ({ ...drafts, [selectedSplit.id]: event.target.value }))}
          />
          <button type="button" disabled={saving} onClick={() => createPlanDay(selectedSplit.id)}>
            <Plus size={18} />
          </button>
        </div>

        <div className="choice-list flat-list">
          {selectedSplit.plans.map((plan) => (
            <button
              type="button"
              key={plan.id}
              onClick={() => {
                setSelectedPlanId(plan.id);
                setPlansStep("exercises");
              }}
            >
              <div>
                <strong>{plan.name}</strong>
                <span>
                  {plan.exercises.length} Übungen · {plan.usage_count} Starts
                </span>
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (plansStep === "exercises" && selectedSplit && selectedPlan) {
    const draft = planExerciseDrafts[selectedPlan.id] ?? emptyDraft();
    const settingsOpen = Boolean(exerciseSettingsOpen[selectedPlan.id]);

    return (
      <section className="screen-content">
        <EditorHeader
          title={selectedPlan.name}
          subtitle={`${selectedSplit.name} · ${selectedPlan.exercises.length} Übungen`}
          onBack={() => {
            setPlansStep("days");
            setSelectedPlanId(null);
          }}
        />

        <article className="editor-panel">
          <div className="panel-heading">
            <h2>Übung hinzufügen</h2>
            <span>Tippen, auswählen, fertig. Details über den kleinen Button.</span>
          </div>
          <ExerciseDraftFields
            draft={draft}
            setDraft={(nextDraft) => setPlanExerciseDrafts((drafts) => ({ ...drafts, [selectedPlan.id]: nextDraft }))}
            exercises={state.exercises}
            muscleGroups={state.muscleGroups}
            placeholder="Übungsname"
            settingsOpen={settingsOpen}
            setSettingsOpen={(open) => setExerciseSettingsOpen((current) => ({ ...current, [selectedPlan.id]: open }))}
          />
          <button className="secondary-action" type="button" disabled={saving} onClick={() => addPlanExercise(selectedPlan.id)}>
            Übung hinzufügen
          </button>
        </article>

        <div className="exercise-overview-list">
          {selectedPlan.exercises.map((planExercise, index) => (
            <article className="exercise-overview-row" key={planExercise.id}>
              <div className="exercise-index">{index + 1}</div>
              <div>
                <strong>{planExercise.exercise.name}</strong>
                <MuscleChips groups={planExercise.exercise.muscle_groups} />
              </div>
              <button type="button" onClick={() => removePlanExercise(planExercise.id)} aria-label="Übung löschen">
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="screen-content">
      <form className="wizard-card" onSubmit={createSplit}>
        <div className="wizard-heading">
          <Layers3 size={22} />
          <div>
            <h2>Neuer Split</h2>
            <p>Split-Name und Trainingstage eintragen. Übungen kommen danach separat.</p>
          </div>
        </div>
        <input placeholder="Split-Name, z. B. Push Pull" value={splitName} onChange={(event) => setSplitName(event.target.value)} />
        <input placeholder="Trainingstage, z. B. Push, Pull" value={splitDays} onChange={(event) => setSplitDays(event.target.value)} />
        <button className="secondary-action" type="submit" disabled={saving}>
          Split speichern
        </button>
      </form>

      <div className="choice-list flat-list">
        {state.splits.map((split) => (
          <button
            type="button"
            key={split.id}
            onClick={() => {
              setSelectedSplitId(split.id);
              setSelectedPlanId(null);
              setPlansStep("days");
            }}
          >
            <div>
              <strong>{split.name}</strong>
              <span>
                {split.plans.length} Trainingstage · {split.usage_count} Starts
              </span>
            </div>
            <ChevronRight />
          </button>
        ))}
      </div>
    </section>
  );
}

function EditorHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <div className="editor-header">
      <button type="button" onClick={onBack} aria-label="Zurück">
        <ArrowLeft size={20} />
      </button>
      <div>
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

function ActiveWorkoutView({
  activeWorkout,
  elapsedSeconds,
  finishWorkout,
  discardActiveWorkout,
  addSet,
  copySet,
  applyLastWorkoutValues,
  applyLastSetValues,
  bumpSetValue,
  updateSet,
  removeActiveExercise,
  addActiveExercise,
  activeExerciseDraft,
  setActiveExerciseDraft,
  exerciseSettingsOpen,
  setExerciseSettingsOpen,
  exercises,
  muscleGroups,
  lastValues,
  workoutRating,
  setWorkoutRating,
  canFinish,
  saveError,
  saving
}: {
  activeWorkout: ActiveWorkout;
  elapsedSeconds: number;
  finishWorkout: () => void;
  discardActiveWorkout: () => void;
  addSet: (exerciseIndex: number) => void;
  copySet: (exerciseIndex: number, setIndex: number) => void;
  applyLastWorkoutValues: (exerciseIndex: number) => void;
  applyLastSetValues: (exerciseIndex: number, setIndex: number) => void;
  bumpSetValue: (exerciseIndex: number, setIndex: number, field: "weight" | "reps", amount: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, field: "weight" | "reps" | "note", value: string) => void;
  removeActiveExercise: (exerciseIndex: number) => void;
  addActiveExercise: () => void;
  activeExerciseDraft: ExerciseDraft;
  setActiveExerciseDraft: (draft: ExerciseDraft) => void;
  exerciseSettingsOpen: Partial<Record<number | "active", boolean>>;
  setExerciseSettingsOpen: React.Dispatch<React.SetStateAction<Partial<Record<number | "active", boolean>>>>;
  exercises: Exercise[];
  muscleGroups: MuscleGroup[];
  lastValues: AppState["lastValues"];
  workoutRating: number;
  setWorkoutRating: (rating: number) => void;
  canFinish: boolean;
  saveError: string;
  saving: boolean;
}) {
  return (
    <section className="screen-content active-workout">
      <div className="timer-card compact-timer">
        <div>
          <span>Aktiv</span>
          <p>{activeWorkout.title}</p>
        </div>
        <strong>{formatTimer(elapsedSeconds)}</strong>
      </div>

      {activeWorkout.exercises.map((exercise, exerciseIndex) => {
        const lastValue = lastValues[exercise.exerciseId];
        const lastSets = getLastSets(lastValue);

        return (
          <article className="tracking-card" key={`${exercise.exerciseId}-${exerciseIndex}`}>
            <div className="tracking-heading">
              <div>
                <h2>{exercise.name}</h2>
                <MuscleChips groups={exercise.muscleGroups} />
                <span>{lastValue ? `Letztes Training: ${formatDateShort(lastValue.trained_on)}` : "Noch keine letzten Werte"}</span>
              </div>
              <div className="tracking-actions">
                <button type="button" onClick={() => addSet(exerciseIndex)}>
                  Satz +
                </button>
                {lastSets.length > 0 ? (
                  <button className="ghost-action" type="button" onClick={() => applyLastWorkoutValues(exerciseIndex)}>
                    Letzte übernehmen
                  </button>
                ) : null}
              </div>
            </div>

            {lastSets.length > 0 ? (
              <div className="last-sets-strip" aria-label={`Letzte Sätze für ${exercise.name}`}>
                {lastSets.map((lastSet) => (
                  <span key={lastSet.set_number}>
                    S{lastSet.set_number}: {formatNumber(lastSet.weight_kg)} kg x {lastSet.reps}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="set-grid set-grid-header">
              <span>Satz</span>
              <span>Gewicht</span>
              <span>Wdh.</span>
              <span />
            </div>
            {exercise.sets.map((set, setIndex) => {
              const lastSet = lastSets[setIndex] ?? lastSets.at(-1);

              return (
                <div className="set-entry" key={setIndex}>
                  <div className="set-grid">
                    <strong>{setIndex + 1}</strong>
                    <input
                      inputMode="decimal"
                      placeholder={lastSet ? `${formatNumber(lastSet.weight_kg)} kg` : "kg"}
                      value={set.weight}
                      onChange={(event) => updateSet(exerciseIndex, setIndex, "weight", event.target.value)}
                    />
                    <input
                      inputMode="numeric"
                      placeholder={lastSet ? `${lastSet.reps} Wdh.` : "Wdh."}
                      value={set.reps}
                      onChange={(event) => updateSet(exerciseIndex, setIndex, "reps", event.target.value)}
                    />
                    <button className="copy-set-button" type="button" onClick={() => copySet(exerciseIndex, setIndex)} aria-label="Satz kopieren">
                      <Copy size={16} />
                    </button>
                  </div>
                  <div className="set-quick-actions">
                    {lastSet ? (
                      <button type="button" onClick={() => applyLastSetValues(exerciseIndex, setIndex)}>
                        Letzten Satz
                      </button>
                    ) : null}
                    <button type="button" onClick={() => bumpSetValue(exerciseIndex, setIndex, "weight", 2.5)}>
                      +2,5 kg
                    </button>
                    <button type="button" onClick={() => bumpSetValue(exerciseIndex, setIndex, "reps", 1)}>
                      +1 Wdh.
                    </button>
                  </div>
                  <input
                    className="set-note-input"
                    placeholder={lastSet?.note ? `Letzte Notiz: ${lastSet.note}` : "Notiz zum Satz"}
                    value={set.note}
                    onChange={(event) => updateSet(exerciseIndex, setIndex, "note", event.target.value)}
                  />
                  {lastValue?.set_notes[setIndex + 1] ? <span className="last-set-note">Letzte Notiz: {lastValue.set_notes[setIndex + 1]}</span> : null}
                </div>
              );
            })}

            <button className="danger-wide-action" type="button" onClick={() => removeActiveExercise(exerciseIndex)}>
              <Trash2 size={16} />
              Übung löschen
            </button>
          </article>
        );
      })}

      <article className="tracking-card">
        <div className="tracking-heading">
          <div>
            <h2>Übung hinzufügen</h2>
            <span>Gilt nur für dieses Training.</span>
          </div>
        </div>
        <ExerciseDraftFields
          draft={activeExerciseDraft}
          setDraft={setActiveExerciseDraft}
          exercises={exercises}
          muscleGroups={muscleGroups}
          placeholder="Übungsname"
          settingsOpen={Boolean(exerciseSettingsOpen.active)}
          setSettingsOpen={(open) => setExerciseSettingsOpen((current) => ({ ...current, active: open }))}
        />
        <button className="secondary-action" type="button" onClick={addActiveExercise}>
          Übung hinzufügen
        </button>
      </article>

      <article className="rating-card">
        <div>
          <h2>Workout bewerten</h2>
          <span>1 bis 5 Sterne, damit es schnell bleibt.</span>
        </div>
        <div className="star-row">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              className={workoutRating >= rating ? "active" : ""}
              type="button"
              key={rating}
              onClick={() => setWorkoutRating(rating)}
              aria-label={`${rating} Sterne`}
            >
              ★
            </button>
          ))}
        </div>
      </article>

      <button className="discard-workout-button" type="button" onClick={discardActiveWorkout}>
        Training verwerfen
      </button>
      {saveError ? <p className="save-error">{saveError}</p> : null}
      {!canFinish ? <p className="finish-hint">Trage mindestens einen Satz mit Wiederholungen ein, dann kannst du speichern.</p> : null}
      <button className="finish-button" type="button" disabled={saving || !canFinish} onClick={finishWorkout}>
        <Check size={20} />
        Training beenden
      </button>
    </section>
  );
}

function StartWorkoutModal({
  step,
  setStep,
  splits,
  selectedSplit,
  setSelectedSplit,
  startWorkout,
  onClose
}: {
  step: StartStep;
  setStep: (step: StartStep) => void;
  splits: TrainingSplit[];
  selectedSplit: TrainingSplit | null;
  setSelectedSplit: (split: TrainingSplit) => void;
  startWorkout: (plan?: TrainingPlan) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section className="modal-card">
        <div className="modal-heading">
          <div>
            <span className="mini-label">Training starten</span>
            <h2>{step === "split" ? "Split wählen" : selectedSplit?.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        {step === "split" ? (
          <div className="choice-list">
            {splits.map((split) => (
              <button
                type="button"
                key={split.id}
                onClick={() => {
                  setSelectedSplit(split);
                  setStep("plan");
                }}
              >
                <div>
                  <strong>{split.name}</strong>
                  <span>
                    {split.plans.length} Trainingstage · {split.usage_count} Starts
                  </span>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
        ) : (
          <div className="choice-list">
            <button className="back-choice" type="button" onClick={() => setStep("split")}>
              Zurück zu Splits
            </button>
            {selectedSplit?.plans.map((plan) => (
              <button type="button" key={plan.id} onClick={() => startWorkout(plan)}>
                <div>
                  <strong>{plan.name}</strong>
                  <span>
                    {plan.exercises.length} Übungen · {plan.usage_count} Starts
                  </span>
                </div>
                <TimerReset />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ExerciseDraftFields({
  draft,
  setDraft,
  exercises,
  muscleGroups,
  placeholder,
  settingsOpen = false,
  setSettingsOpen
}: {
  draft: ExerciseDraft;
  setDraft: (draft: ExerciseDraft) => void;
  exercises: Exercise[];
  muscleGroups: MuscleGroup[];
  placeholder: string;
  settingsOpen?: boolean;
  setSettingsOpen?: (open: boolean) => void;
}) {
  const suggestions = getExerciseSuggestions(exercises, draft.name);

  return (
    <div className="exercise-draft">
      <div className="draft-input-row">
        <input
          placeholder={placeholder}
          value={draft.name}
          onChange={(event) => {
            const name = event.target.value;
            const existing = findExercise(exercises, name);
            setDraft({
              name,
              muscleGroupIds: existing ? existing.muscle_groups.map((group) => group.id) : draft.muscleGroupIds
            });
          }}
        />
        <button type="button" aria-label="Übungseinstellungen" onClick={() => setSettingsOpen?.(!settingsOpen)}>
          <Settings2 size={18} />
        </button>
      </div>
      {suggestions.length > 0 ? (
        <div className="exercise-suggestions" aria-label="Übungsvorschläge">
          {suggestions.map((exercise) => (
            <button
              type="button"
              key={exercise.id}
              onClick={() =>
                setDraft({
                  name: exercise.name,
                  muscleGroupIds: exercise.muscle_groups.map((group) => group.id)
                })
              }
            >
              <strong>{exercise.name}</strong>
              {exercise.muscle_groups.length > 0 ? <span>{exercise.muscle_groups.map((group) => group.name).join(", ")}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {settingsOpen ? (
        <div className="chip-picker">
          {muscleGroups.map((group) => {
            const selected = draft.muscleGroupIds.includes(group.id);

            return (
              <button
                className={selected ? "selected" : ""}
                type="button"
                key={group.id}
                onClick={() =>
                  setDraft({
                    ...draft,
                    muscleGroupIds: selected ? draft.muscleGroupIds.filter((id) => id !== group.id) : [...draft.muscleGroupIds, group.id]
                  })
                }
              >
                {group.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function StatsView({
  state,
  bodyweightDraft,
  setBodyweightDraft,
  addBodyweight
}: {
  state: AppState;
  bodyweightDraft: string;
  setBodyweightDraft: (value: string) => void;
  addBodyweight: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const stats = state.stats;
  const progressExerciseName = stats.exerciseProgress.at(-1)?.exerciseName ?? "Übungsfortschritt";

  return (
    <section className="screen-content">
      <article className={`insight-card ${stats.deloadInsight.status}`}>
        <div className="insight-topline">
          <span className="mini-label">Deload-Frühwarnung</span>
          <strong>{stats.deloadInsight.scoreLabel}</strong>
        </div>
        <h2>{stats.deloadInsight.title}</h2>
        <p>{stats.deloadInsight.message}</p>
        <div className="insight-action">{stats.deloadInsight.action}</div>
      </article>

      <article className="insight-card pattern-card">
        <div className="insight-topline">
          <span className="mini-label">Persönliche Muster</span>
          <strong>{stats.personalPatterns.length}</strong>
        </div>
        <div className="pattern-list">
          {stats.personalPatterns.map((pattern) => (
            <div className="pattern-row" key={pattern.title}>
              <h3>{pattern.title}</h3>
              <p>{pattern.message}</p>
              <span>{pattern.detail}</span>
            </div>
          ))}
        </div>
      </article>

      <div className="metric-grid">
        <MetricCard icon={<Trophy />} label="Anzahl der Trainings" value={stats.totalSessions} />
        <MetricCard icon={<TimerReset />} label="Trainingsdauer" value={formatDuration(stats.totalDurationSeconds)} />
        <MetricCard icon={<Activity />} label="Volumen" value={`${Math.round(stats.totalVolume)} kg`} />
        <MetricCard icon={<BarChart3 />} label="Sätze gesamt" value={stats.totalSets} />
        <MetricCard icon={<Dumbbell />} label="Wiederholungen gesamt" value={stats.totalReps} />
        <MetricCard icon={<Weight />} label="Wdh. pro Satz" value={stats.avgRepsPerSet} />
      </div>

      <ChartCard title="Volumen" data={stats.volumeByDate} suffix=" kg" />
      <ChartCard title="Trainingsdauer" data={stats.durationByDate} suffix=" min" />
      <ChartCard title="Körpergewicht" data={stats.bodyweightByDate} suffix=" kg" />
      <ChartCard title={progressExerciseName} data={stats.exerciseProgress} suffix=" kg" />

      <form className="inline-form" onSubmit={addBodyweight}>
        <input
          inputMode="decimal"
          placeholder="Körpergewicht heute"
          value={bodyweightDraft}
          onChange={(event) => setBodyweightDraft(event.target.value)}
        />
        <button type="submit">
          <Plus size={18} />
        </button>
      </form>
    </section>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <article className="metric-card">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ChartCard({ title, data, suffix }: { title: string; data: ChartPoint[]; suffix: string }) {
  const safeData = data.length > 0 ? data : [{ label: "Start", value: 0 }];

  return (
    <article className="chart-card">
      <div className="chart-title">
        <h2>{title}</h2>
        <span>
          {safeData.at(-1)?.value ?? 0}
          {suffix}
        </span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={safeData} margin={{ top: 12, right: 8, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#8b8b92", fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#8b8b92", fontSize: 11 }} />
            <Tooltip
              cursor={{ stroke: "#36363b" }}
              contentStyle={{
                background: "#161619",
                border: "1px solid #303036",
                borderRadius: 12,
                color: "#fff"
              }}
            />
            <Area type="monotone" dataKey="value" stroke={accent} fill={`url(#fill-${title})`} strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function FitnessTopNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  return (
    <nav className="fitness-top-nav" aria-label="Fitness-Bereiche">
      <button className={tab === "diary" ? "active" : ""} type="button" onClick={() => setTab("diary")}>
        <BookOpen size={18} />
        Tagebuch
      </button>
      <button className={tab === "plans" ? "active" : ""} type="button" onClick={() => setTab("plans")}>
        <Dumbbell size={18} />
        Trainingspläne
      </button>
      <button className={tab === "stats" ? "active" : ""} type="button" onClick={() => setTab("stats")}>
        <BarChart3 size={18} />
        Statistik
      </button>
    </nav>
  );
}

function MuscleChips({ groups }: { groups: MuscleGroup[] }) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="muscle-chips">
      {groups.map((group) => (
        <span key={group.id}>{group.name}</span>
      ))}
    </div>
  );
}

function getValidWorkoutExercises(workout: ActiveWorkout) {
  const validExercises = new Map<
    number,
    {
      exerciseId: number;
      sets: {
        weight: number;
        reps: number;
        note: string;
      }[];
    }
  >();

  for (const exercise of workout.exercises) {
    if (exercise.exerciseId <= 0) {
      continue;
    }

    const validSets = exercise.sets
      .map((set) => ({
        weight: parseDecimal(set.weight),
        reps: parseInteger(set.reps),
        note: set.note.trim()
      }))
      .filter((set) => Number.isFinite(set.weight) && Number.isFinite(set.reps) && set.reps > 0);

    if (validSets.length === 0) {
      continue;
    }

    const current = validExercises.get(exercise.exerciseId) ?? { exerciseId: exercise.exerciseId, sets: [] };
    validExercises.set(exercise.exerciseId, {
      ...current,
      sets: [...current.sets, ...validSets]
    });
  }

  return [...validExercises.values()];
}

function parseDecimal(value: string) {
  const normalized = value.trim().replace(",", ".");
  return normalized ? Number(normalized) : 0;
}

function parseInteger(value: string) {
  return Number(value.trim());
}

function readStoredActiveWorkout(): StoredActiveWorkout | null {
  try {
    const rawDraft = window.localStorage.getItem(activeWorkoutStorageKey);

    if (!rawDraft) {
      return null;
    }

    const parsed = JSON.parse(rawDraft) as Partial<StoredActiveWorkout>;

    if (!parsed.workout || !Array.isArray(parsed.workout.exercises) || !parsed.workout.startedAt) {
      return null;
    }

    return {
      workout: parsed.workout,
      rating: Number(parsed.rating) || 0
    };
  } catch {
    return null;
  }
}

function getSuggestedTraining(splits: TrainingSplit[], sessions: WorkoutSession[]): SuggestedTraining | null {
  const splitsWithPlans = splits
    .map((split) => ({
      ...split,
      plans: split.plans.filter((plan) => plan.exercises.length > 0)
    }))
    .filter((split) => split.plans.length > 0);
  const splitWithPlans = splitsWithPlans[0];

  if (!splitWithPlans) {
    return null;
  }

  const latestSession = [...sessions].sort((a, b) => b.trained_on.localeCompare(a.trained_on) || b.id - a.id)[0];
  const latestSplit = latestSession?.plan_id ? splitsWithPlans.find((split) => split.plans.some((plan) => plan.id === latestSession.plan_id)) : null;
  const split = latestSplit ?? splitWithPlans;

  if (!latestSession?.plan_id) {
    return { split, plan: split.plans[0] };
  }

  const lastPlanIndex = split.plans.findIndex((plan) => plan.id === latestSession.plan_id);
  const nextPlanIndex = lastPlanIndex >= 0 ? (lastPlanIndex + 1) % split.plans.length : 0;

  return { split, plan: split.plans[nextPlanIndex] };
}

function getLastSets(lastValue: AppState["lastValues"][number] | undefined) {
  if (!lastValue) {
    return [];
  }

  if (lastValue.sets?.length > 0) {
    return lastValue.sets;
  }

  return [
    {
      set_number: 1,
      weight_kg: lastValue.weight_kg,
      reps: lastValue.reps,
      note: lastValue.set_notes[1] ?? null
    }
  ];
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function formatDateShort(date: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(date));
}

function groupSessionsByMonth(sessions: WorkoutSession[]) {
  const grouped = new Map<string, WorkoutSession[]>();

  for (const session of sessions) {
    const key = formatMonth(session.trained_on);
    grouped.set(key, [...(grouped.get(key) ?? []), session]);
  }

  return grouped;
}

function summarizeSession(session: WorkoutSession) {
  const counts = new Map<string, number>();

  for (const set of session.sets) {
    counts.set(set.exercise.name, (counts.get(set.exercise.name) ?? 0) + 1);
  }

  return [...counts.entries()].slice(0, 6).map(([name, count]) => `${count}x ${name}`);
}

function getSessionExerciseIds(session: WorkoutSession) {
  return [...new Set([...session.sets].sort((a, b) => a.id - b.id).map((set) => set.exercise_id))];
}

function groupSessionSets(session: WorkoutSession) {
  const grouped = new Map<number, SetEntry[]>();

  for (const set of session.sets) {
    grouped.set(set.exercise_id, [...(grouped.get(set.exercise_id) ?? []), set]);
  }

  return [...grouped.values()].map((sets) => ({
    exercise: sets[0].exercise,
    sets: [...sets].sort((a, b) => a.set_number - b.set_number)
  }));
}

function getExerciseSuggestions(exercises: Exercise[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return exercises
    .filter((exercise) => !normalizedQuery || exercise.name.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .slice(0, 30);
}

function formatDateLong(date: string) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(date));
}

function tabTitle(tab: Tab) {
  if (tab === "diary") {
    return "Tagebuch";
  }

  if (tab === "plans") {
    return "Trainingspläne";
  }

  return "Statistik";
}

function renderStars(rating: number) {
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

function emptyDraft(): ExerciseDraft {
  return { name: "", muscleGroupIds: [] };
}

function findExercise(exercises: Exercise[], name: string) {
  return exercises.find((exercise) => exercise.name.toLowerCase() === name.trim().toLowerCase());
}
