import type { AppState, Exercise, MuscleGroup } from "@/lib/types";

const now = new Date();
const today = now.toISOString().slice(0, 10);
const lastWeek = new Date(now);
lastWeek.setDate(now.getDate() - 6);
const earlier = new Date(now);
earlier.setDate(now.getDate() - 13);

const muscleGroups: MuscleGroup[] = [
  { id: 1, name: "Brust" },
  { id: 2, name: "Rücken" },
  { id: 3, name: "Schulter" },
  { id: 4, name: "Bizeps" },
  { id: 5, name: "Trizeps" },
  { id: 6, name: "Beine" },
  { id: 7, name: "Bauch" },
  { id: 8, name: "Waden" },
  { id: 9, name: "Glutes" }
];

const exercises: Exercise[] = [
  { id: 1, name: "Bankdrücken", category: "Brust", muscle_groups: [muscleGroups[0], muscleGroups[2], muscleGroups[4]] },
  { id: 2, name: "Klimmzug", category: "Rücken", muscle_groups: [muscleGroups[1], muscleGroups[3]] },
  { id: 3, name: "Kniebeuge", category: "Beine", muscle_groups: [muscleGroups[5], muscleGroups[8]] },
  { id: 4, name: "Schulterdrücken", category: "Schulter", muscle_groups: [muscleGroups[2], muscleGroups[4]] }
];

export const demoState: AppState = {
  muscleGroups,
  exercises,
  splits: [
    {
      id: 1,
      name: "Push Pull",
      sort_order: 1,
      is_active: true,
      usage_count: 2,
      plans: [
        {
          id: 1,
          split_id: 1,
          name: "Push",
          sort_order: 1,
          is_active: true,
          usage_count: 2,
          exercises: [
            { id: 1, plan_id: 1, exercise_id: 1, position: 1, exercise: exercises[0] },
            { id: 2, plan_id: 1, exercise_id: 4, position: 2, exercise: exercises[3] }
          ]
        },
        {
          id: 2,
          split_id: 1,
          name: "Pull",
          sort_order: 2,
          is_active: true,
          usage_count: 0,
          exercises: [{ id: 3, plan_id: 2, exercise_id: 2, position: 1, exercise: exercises[1] }]
        }
      ]
    },
    {
      id: 2,
      name: "Beine",
      sort_order: 2,
      is_active: true,
      usage_count: 1,
      plans: [
        {
          id: 3,
          split_id: 2,
          name: "Unterkörper",
          sort_order: 1,
          is_active: true,
          usage_count: 1,
          exercises: [{ id: 4, plan_id: 3, exercise_id: 3, position: 1, exercise: exercises[2] }]
        }
      ]
    }
  ],
  plans: [],
  sessions: [
    {
      id: 1,
      plan_id: 1,
      title: "Push",
      trained_on: today,
      started_at: null,
      ended_at: null,
      duration_seconds: 4260,
      rating: 4,
      notes: null,
      sets: [
        { id: 1, session_id: 1, exercise_id: 1, set_number: 1, weight_kg: 70, reps: 8, note: "Sauber, noch 1 Wdh. im Tank", exercise: exercises[0] },
        { id: 2, session_id: 1, exercise_id: 1, set_number: 2, weight_kg: 70, reps: 7, note: null, exercise: exercises[0] },
        { id: 3, session_id: 1, exercise_id: 4, set_number: 1, weight_kg: 40, reps: 9, note: "Etwas langsamer hochdrücken", exercise: exercises[3] }
      ]
    },
    {
      id: 2,
      plan_id: 3,
      title: "Unterkörper",
      trained_on: lastWeek.toISOString().slice(0, 10),
      started_at: null,
      ended_at: null,
      duration_seconds: 3720,
      rating: 5,
      notes: null,
      sets: [
        { id: 4, session_id: 2, exercise_id: 3, set_number: 1, weight_kg: 100, reps: 8, note: "Tiefe war gut", exercise: exercises[2] },
        { id: 5, session_id: 2, exercise_id: 3, set_number: 2, weight_kg: 100, reps: 8, note: null, exercise: exercises[2] }
      ]
    },
    {
      id: 3,
      plan_id: 1,
      title: "Push",
      trained_on: earlier.toISOString().slice(0, 10),
      started_at: null,
      ended_at: null,
      duration_seconds: 3900,
      rating: 3,
      notes: null,
      sets: [
        { id: 6, session_id: 3, exercise_id: 1, set_number: 1, weight_kg: 67.5, reps: 8, note: "Mehr Pause nehmen", exercise: exercises[0] },
        { id: 7, session_id: 3, exercise_id: 4, set_number: 1, weight_kg: 37.5, reps: 8, note: null, exercise: exercises[3] }
      ]
    }
  ],
  bodyweight: [
    { id: 1, measured_on: earlier.toISOString().slice(0, 10), weight_kg: 79.8 },
    { id: 2, measured_on: lastWeek.toISOString().slice(0, 10), weight_kg: 79.4 },
    { id: 3, measured_on: today, weight_kg: 79.1 }
  ],
  lastValues: {
    1: {
      weight_kg: 70,
      reps: 8,
      trained_on: today,
      set_notes: { 1: "Sauber, noch 1 Wdh. im Tank" },
      sets: [
        { set_number: 1, weight_kg: 70, reps: 8, note: "Sauber, noch 1 Wdh. im Tank" },
        { set_number: 2, weight_kg: 70, reps: 7, note: null }
      ]
    },
    2: { weight_kg: 0, reps: 9, trained_on: today, set_notes: {}, sets: [{ set_number: 1, weight_kg: 0, reps: 9, note: null }] },
    3: {
      weight_kg: 100,
      reps: 8,
      trained_on: lastWeek.toISOString().slice(0, 10),
      set_notes: { 1: "Tiefe war gut" },
      sets: [
        { set_number: 1, weight_kg: 100, reps: 8, note: "Tiefe war gut" },
        { set_number: 2, weight_kg: 100, reps: 8, note: null }
      ]
    },
    4: {
      weight_kg: 40,
      reps: 9,
      trained_on: today,
      set_notes: { 1: "Etwas langsamer hochdrücken" },
      sets: [{ set_number: 1, weight_kg: 40, reps: 9, note: "Etwas langsamer hochdrücken" }]
    }
  },
  stats: {
    totalSessions: 3,
    totalDurationSeconds: 11880,
    totalVolume: 4490,
    totalSets: 7,
    totalReps: 56,
    avgRepsPerSet: 8,
    volumeByDate: [
      { label: "W-2", value: 840 },
      { label: "W-1", value: 1600 },
      { label: "Jetzt", value: 2050 }
    ],
    durationByDate: [
      { label: "W-2", value: 65 },
      { label: "W-1", value: 62 },
      { label: "Jetzt", value: 71 }
    ],
    setsByDate: [
      { label: "W-2", value: 2 },
      { label: "W-1", value: 2 },
      { label: "Jetzt", value: 3 }
    ],
    repsByDate: [
      { label: "W-2", value: 16 },
      { label: "W-1", value: 16 },
      { label: "Jetzt", value: 24 }
    ],
    bodyweightByDate: [
      { label: "W-2", value: 79.8 },
      { label: "W-1", value: 79.4 },
      { label: "Jetzt", value: 79.1 }
    ],
    exerciseProgress: [
      { exerciseId: 1, exerciseName: "Bankdrücken", label: "W-2", value: 67.5 },
      { exerciseId: 1, exerciseName: "Bankdrücken", label: "Jetzt", value: 70 }
    ],
    deloadInsight: {
      status: "ready",
      title: "Kein Deload-Signal",
      message: "Deine letzten Trainings sehen stabil genug aus.",
      action: "Trainiere normal weiter und steigere nur, wenn die Sätze sauber bleiben.",
      scoreLabel: "stabil"
    },
    personalPatterns: [
      {
        title: "Stärkster Trainingstag",
        message: "Deine beste Leistung pro Satz kommt aktuell am Montag.",
        detail: "Sobald WHOOP verbunden ist, wird das mit Schlaf und Recovery kombiniert."
      },
      {
        title: "Beste Übungsentwicklung",
        message: "Bankdrücken entwickelt sich aktuell am besten.",
        detail: "Stärkster Satz ist um 2,5 kg gestiegen."
      }
    ]
  }
};
