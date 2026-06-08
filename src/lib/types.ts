export type MuscleGroup = {
  id: number;
  name: string;
};

export type Exercise = {
  id: number;
  name: string;
  category: string | null;
  muscle_groups: MuscleGroup[];
};

export type TrainingSplit = {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  plans: TrainingPlan[];
  usage_count: number;
};

export type TrainingPlan = {
  id: number;
  split_id: number | null;
  name: string;
  sort_order: number;
  is_active: boolean;
  exercises: PlanExercise[];
  usage_count: number;
};

export type PlanExercise = {
  id: number;
  plan_id: number;
  exercise_id: number;
  position: number;
  exercise: Exercise;
};

export type WorkoutSession = {
  id: number;
  plan_id: number | null;
  title: string;
  trained_on: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  rating: number | null;
  notes: string | null;
  sets: SetEntry[];
};

export type SetEntry = {
  id: number;
  session_id: number;
  exercise_id: number;
  set_number: number;
  weight_kg: number;
  reps: number;
  note: string | null;
  exercise: Exercise;
};

export type BodyweightEntry = {
  id: number;
  measured_on: string;
  weight_kg: number;
};

export type ExerciseLastValues = Record<
  number,
  {
    weight_kg: number;
    reps: number;
    trained_on: string;
    set_notes: Record<number, string>;
    sets: {
      set_number: number;
      weight_kg: number;
      reps: number;
      note: string | null;
    }[];
  }
>;

export type AppStats = {
  totalSessions: number;
  totalDurationSeconds: number;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  avgRepsPerSet: number;
  volumeByDate: ChartPoint[];
  durationByDate: ChartPoint[];
  setsByDate: ChartPoint[];
  repsByDate: ChartPoint[];
  bodyweightByDate: ChartPoint[];
  exerciseProgress: ExerciseProgressPoint[];
  deloadInsight: DeloadInsight;
  personalPatterns: PersonalPattern[];
};

export type DeloadInsight = {
  status: "learning" | "ready" | "watch" | "deload";
  title: string;
  message: string;
  action: string;
  scoreLabel: string;
};

export type PersonalPattern = {
  title: string;
  message: string;
  detail: string;
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type ExerciseProgressPoint = {
  exerciseId: number;
  exerciseName: string;
  label: string;
  value: number;
};

export type AppState = {
  splits: TrainingSplit[];
  plans: TrainingPlan[];
  exercises: Exercise[];
  muscleGroups: MuscleGroup[];
  sessions: WorkoutSession[];
  bodyweight: BodyweightEntry[];
  lastValues: ExerciseLastValues;
  stats: AppStats;
};

export type ActiveExercise = {
  exerciseId: number;
  name: string;
  muscleGroups: MuscleGroup[];
  sets: {
    weight: string;
    reps: string;
    note: string;
  }[];
};
