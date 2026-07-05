import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { firstLessonId, portalDocs, projectDecisions, seedCourses } from "./data/portalData";
import type { Course, Lesson, Reference, Role, Unit } from "./data/portalData";
import { hasCloudStore, loadCoursesFromCloud, saveCoursesToCloud, uploadPortalAsset } from "./services/cloudStore";

type Theme = "light" | "dark";
type ProgressState = {
  completed: Record<string, boolean>;
  favorites: string[];
  recent: string[];
};

const STUDENT_PASSWORD = "MrTStds";
const TEACHER_PASSWORD = "MrTAdmin";
const SESSION_KEY = "mrt-portal-session";
const THEME_KEY = "mrt-portal-theme";
const PROGRESS_KEY = "mrt-portal-progress";
const LOCAL_COURSE_CACHE = "mrt-portal-course-cache";

const classroomImage = "https://images.pexels.com/photos/5539293/pexels-photo-5539293.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1600";

const emptyProgress: ProgressState = { completed: {}, favorites: [], recent: [] };

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function App() {
  const [sessionRole, setSessionRole] = useState<Role | null>(() => {
    const saved = window.sessionStorage.getItem(SESSION_KEY);
    return saved === "student" || saved === "teacher" ? saved : null;
  });
  const [theme, setTheme] = useState<Theme>(() => (window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"));
  const [courses, setCourses] = useState<Course[]>(() => mergeUpdatedSeedCourses(readJson<Course[]>(LOCAL_COURSE_CACHE, seedCourses)));
  const [progress, setProgress] = useState<ProgressState>(() => readJson<ProgressState>(PROGRESS_KEY, emptyProgress));
  const [selectedCourseId, setSelectedCourseId] = useState("ap-cybersecurity");
  const [selectedUnitId, setSelectedUnitId] = useState("cyber-unit-1");
  const [selectedLessonId, setSelectedLessonId] = useState(firstLessonId);
  const [search, setSearch] = useState("");
  const [teacherToolsOpen, setTeacherToolsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [cloudMessage, setCloudMessage] = useState(hasCloudStore ? "Connecting to Supabase..." : "Supabase not configured. Seed content is active.");
  const [cloudState, setCloudState] = useState(hasCloudStore ? "connected" : "not-configured");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    writeJson(PROGRESS_KEY, progress);
  }, [progress]);

  useEffect(() => {
    loadCoursesFromCloud().then((result) => {
      if (result.courses?.length) {
        const mergedCourses = mergeUpdatedSeedCourses(result.courses);
        setCourses(mergedCourses);
        writeJson(LOCAL_COURSE_CACHE, mergedCourses);
      } else {
        setCourses((current) => {
          const mergedCourses = mergeUpdatedSeedCourses(current);
          writeJson(LOCAL_COURSE_CACHE, mergedCourses);
          return mergedCourses;
        });
      }
      setCloudMessage(result.message);
      setCloudState(result.state);
    });
  }, []);

  const allLessons = useMemo(() => flattenLessons(courses), [courses]);
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? courses[0];
  const selectedUnit = selectedCourse.units.find((unit) => unit.id === selectedUnitId) ?? selectedCourse.units[0];
  const selectedLesson = selectedUnit.lessons.find((lesson) => lesson.id === selectedLessonId) ?? selectedUnit.lessons[0];

  useEffect(() => {
    document.title = selectedLesson ? `${selectedLesson.title} | Mr. T's AP Computer Science Portal` : "Mr. T's AP Computer Science Portal";
  }, [selectedLesson]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return allLessons.filter((lesson) => lessonSearchText(lesson).includes(query)).slice(0, 10);
  }, [allLessons, search]);

  if (!sessionRole) {
    return <LoginScreen onLogin={setSessionRole} />;
  }

  const completedCount = selectedCourse.units
    .flatMap((unit) => unit.lessons)
    .filter((lesson) => progress.completed[lesson.id]).length;
  const lessonCount = selectedCourse.units.flatMap((unit) => unit.lessons).length;
  const progressPercent = lessonCount ? Math.round((completedCount / lessonCount) * 100) : 0;

  function persistCourses(nextCourses: Course[], messagePrefix = "Saved") {
    setCourses(nextCourses);
    writeJson(LOCAL_COURSE_CACHE, nextCourses);
    saveCoursesToCloud(nextCourses).then((result) => {
      setCloudState(result.state);
      setCloudMessage(`${messagePrefix}. ${result.message}`);
    });
  }

  function selectCourse(courseId: string) {
    const course = courses.find((item) => item.id === courseId) ?? courses[0];
    const unit = course.units[0];
    const lesson = unit.lessons[0];
    setSelectedCourseId(course.id);
    setSelectedUnitId(unit.id);
    setSelectedLessonId(lesson.id);
    addRecentLesson(lesson.id);
    setMobileNavOpen(false);
  }

  function selectLesson(courseId: string, unitId: string, lessonId: string) {
    setSelectedCourseId(courseId);
    setSelectedUnitId(unitId);
    setSelectedLessonId(lessonId);
    addRecentLesson(lessonId);
    setMobileNavOpen(false);
  }

  function addRecentLesson(lessonId: string) {
    setProgress((current) => ({
      ...current,
      recent: [lessonId, ...current.recent.filter((id) => id !== lessonId)].slice(0, 8),
    }));
  }

  function toggleCompleted(lessonId: string) {
    setProgress((current) => ({
      ...current,
      completed: { ...current.completed, [lessonId]: !current.completed[lessonId] },
    }));
  }

  function toggleFavorite(lessonId: string) {
    setProgress((current) => ({
      ...current,
      favorites: current.favorites.includes(lessonId)
        ? current.favorites.filter((id) => id !== lessonId)
        : [lessonId, ...current.favorites],
    }));
  }

  function updateLesson(updatedLesson: Lesson, message = "Lesson saved") {
    const nextCourses = courses.map((course) => ({
      ...course,
      units: course.units.map((unit) => ({
        ...unit,
        lessons: unit.lessons.map((lesson) => (lesson.id === updatedLesson.id ? updatedLesson : lesson)),
      })),
    }));
    persistCourses(nextCourses, message);
  }

  function addLesson(courseId: string, unitId: string) {
    const id = `${unitId}-custom-${Date.now()}`;
    const newLesson = createTeacherLesson(id, courseId, unitId);
    const nextCourses = courses.map((course) =>
      course.id !== courseId
        ? course
        : {
            ...course,
            units: course.units.map((unit) => (unit.id === unitId ? { ...unit, lessons: [...unit.lessons, newLesson] } : unit)),
          },
    );
    persistCourses(nextCourses, "New lesson added");
    selectLesson(courseId, unitId, id);
  }

  function deleteLesson(lessonId: string) {
    if (!window.confirm("Delete this lesson? This cannot be undone unless you restore from a backup.")) return;
    const nextCourses = courses.map((course) => ({
      ...course,
      units: course.units.map((unit) => ({ ...unit, lessons: unit.lessons.filter((lesson) => lesson.id !== lessonId) })),
    }));
    persistCourses(nextCourses, "Lesson deleted");
    const firstAvailable = flattenLessons(nextCourses)[0];
    if (firstAvailable) {
      selectLesson(firstAvailable.courseId, firstAvailable.unitId, firstAvailable.id);
    }
  }

  function exportNotes() {
    downloadJson("mrt-ap-portal-backup.json", {
      exportedAt: new Date().toISOString(),
      courses,
      progress,
      decisions: projectDecisions,
    });
  }

  function importNotes(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as { courses?: Course[] };
        if (!parsed.courses?.length) throw new Error("Backup does not contain courses.");
        persistCourses(parsed.courses, "Imported notes");
      } catch (error) {
        setCloudMessage(error instanceof Error ? error.message : "Could not import notes.");
      }
    };
    reader.readAsText(file);
  }

  function restoreSeed() {
    if (!window.confirm("Restore the official Phase 1 seed content? Current edits will be replaced unless you exported a backup.")) return;
    persistCourses(seedCourses, "Restored official seed content");
    selectLesson(seedCourses[0].id, seedCourses[0].units[0].id, seedCourses[0].units[0].lessons[0].id);
  }

  function logout() {
    window.sessionStorage.removeItem(SESSION_KEY);
    setSessionRole(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-[#07111f] dark:text-slate-100">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#08182b]/90 print:hidden">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 lg:hidden dark:border-white/15 dark:text-slate-100"
            onClick={() => setMobileNavOpen((open) => !open)}
            type="button"
          >
            Lessons
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">Mr. T's AP Computer Science Portal</p>
            <h1 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{selectedCourse.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="toolbar-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            {sessionRole === "teacher" && (
              <button className="toolbar-button" onClick={() => setTeacherToolsOpen((open) => !open)} type="button">
                Teacher Tools
              </button>
            )}
            <button className="toolbar-button" onClick={logout} type="button">
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <AnimatePresence>
          {(mobileNavOpen || window.matchMedia("(min-width: 1024px)").matches) && (
            <motion.aside
              animate={{ x: 0, opacity: 1 }}
              className={classNames(
                "fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[340px] overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-2xl lg:sticky lg:top-[73px] lg:z-10 lg:h-[calc(100vh-73px)] lg:w-auto lg:max-w-none lg:shadow-none dark:border-white/10 dark:bg-[#0b1c32]",
                mobileNavOpen ? "block" : "hidden lg:block",
              )}
              exit={{ x: -40, opacity: 0 }}
              initial={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <CourseNavigation
                allLessons={allLessons}
                courses={courses}
                onSelectCourse={selectCourse}
                onSelectLesson={selectLesson}
                progress={progress}
                progressPercent={progressPercent}
                search={search}
                searchResults={searchResults}
                selectedCourse={selectedCourse}
                selectedLesson={selectedLesson}
                selectedUnit={selectedUnit}
                setMobileNavOpen={setMobileNavOpen}
                setSearch={setSearch}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="min-w-0 px-4 py-6 lg:px-8" id="main-content">
          <CourseHero
            cloudMessage={cloudMessage}
            cloudState={cloudState}
            course={selectedCourse}
            lessonCount={lessonCount}
            progressPercent={progressPercent}
            role={sessionRole}
          />

          <Breadcrumbs course={selectedCourse} lesson={selectedLesson} unit={selectedUnit} />

          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <motion.section
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 12 }}
              key={selectedLesson.id}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <LessonActions
                completed={Boolean(progress.completed[selectedLesson.id])}
                favorite={progress.favorites.includes(selectedLesson.id)}
                lesson={selectedLesson}
                onToggleCompleted={toggleCompleted}
                onToggleFavorite={toggleFavorite}
              />
              <LessonContent lesson={selectedLesson} />
            </motion.section>

            <aside className="space-y-5 print:hidden">
              <QuickStudyPanel
                allLessons={allLessons}
                favorites={progress.favorites}
                onSelectLesson={selectLesson}
                recent={progress.recent}
              />
              <StudentToolsPanel exportNotes={exportNotes} />
              <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950" onClick={() => setDocsOpen((open) => !open)} type="button">
                {docsOpen ? "Hide" : "Show"} deployment guide and manuals
              </button>
              <AnimatePresence>{docsOpen && <DocsPanel />}</AnimatePresence>
            </aside>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {teacherToolsOpen && sessionRole === "teacher" && (
          <TeacherTools
            course={selectedCourse}
            deleteLesson={deleteLesson}
            importNotes={importNotes}
            lesson={selectedLesson}
            onAddLesson={addLesson}
            onClose={() => setTeacherToolsOpen(false)}
            onExport={exportNotes}
            onRestore={restoreSeed}
            onUpdateLesson={updateLesson}
            unit={selectedUnit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password === TEACHER_PASSWORD) {
      window.sessionStorage.setItem(SESSION_KEY, "teacher");
      onLogin("teacher");
      return;
    }
    if (password === STUDENT_PASSWORD) {
      window.sessionStorage.setItem(SESSION_KEY, "student");
      onLogin("student");
      return;
    }
    setError("That password does not match a student or teacher account.");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <img alt="Students working in a computer lab" className="absolute inset-0 h-full w-full object-cover opacity-42" src={classroomImage} />
      <div className="absolute inset-0 bg-gradient-to-r from-[#061326] via-[#061326]/88 to-[#061326]/35" />
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex min-h-screen items-center px-6 py-10"
        initial={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
          <section className="max-w-3xl">
            <motion.p
              animate={{ opacity: 1, x: 0 }}
              className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300"
              initial={{ opacity: 0, x: -14 }}
              transition={{ delay: 0.15, duration: 0.45 }}
            >
              Private teaching portal
            </motion.p>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-7xl">Mr. T's AP Computer Science Portal</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              A modern home for AP Cybersecurity, AP Computer Science Principles, and AP Computer Science A. Log in to read notes, search topics, print lessons, and download PDFs.
            </p>
          </section>

          <motion.form
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-white/18 bg-white/12 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl"
            initial={{ opacity: 0, scale: 0.96 }}
            onSubmit={submitLogin}
            transition={{ delay: 0.25, duration: 0.35 }}
          >
            <h2 className="text-2xl font-semibold">Portal Login</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">Enter the student or teacher password to continue.</p>
            <label className="mt-6 block text-sm font-semibold" htmlFor="portal-password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-white/20 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-300/25"
              id="portal-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            {error && <p className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">{error}</p>}
            <button className="mt-5 w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300" type="submit">
              Enter Portal
            </button>
            <p className="mt-4 text-xs leading-5 text-slate-300">Phase 1 uses a simple password gate as approved. For sensitive student data, move to individual Supabase Auth accounts in a future phase.</p>
          </motion.form>
        </div>
      </motion.div>
    </main>
  );
}

function CourseNavigation({
  allLessons,
  courses,
  onSelectCourse,
  onSelectLesson,
  progress,
  progressPercent,
  search,
  searchResults,
  selectedCourse,
  selectedLesson,
  selectedUnit,
  setMobileNavOpen,
  setSearch,
}: {
  allLessons: Lesson[];
  courses: Course[];
  onSelectCourse: (courseId: string) => void;
  onSelectLesson: (courseId: string, unitId: string, lessonId: string) => void;
  progress: ProgressState;
  progressPercent: number;
  search: string;
  searchResults: Lesson[];
  selectedCourse: Course;
  selectedLesson: Lesson;
  selectedUnit: Unit;
  setMobileNavOpen: (open: boolean) => void;
  setSearch: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => ({
    "cyber-unit-1": true,
    "cyber-unit-2": true,
    "cyber-unit-3": true,
    "cyber-unit-4": true,
    "cyber-unit-5": true,
  }));

  function toggleUnit(unitId: string) {
    setExpanded((current) => ({ ...current, [unitId]: !current[unitId] }));
  }

  return (
    <nav aria-label="Course lessons" className="space-y-5">
      <div className="flex items-start justify-between gap-3 lg:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">Navigation</p>
          <p className="font-semibold">Lessons and search</p>
        </div>
        <button className="rounded-lg border border-slate-300 px-3 py-1 text-sm dark:border-white/15" onClick={() => setMobileNavOpen(false)} type="button">
          Close
        </button>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="lesson-search">
          Search notes
        </label>
        <input
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-300/25 dark:border-white/10 dark:bg-white/8 dark:text-white"
          id="lesson-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Try phishing, firewall, hashing..."
          type="search"
          value={search}
        />
      </div>

      {search && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Search results</p>
          {searchResults.length ? (
            searchResults.map((lesson) => (
              <button className="search-result" key={lesson.id} onClick={() => onSelectLesson(lesson.courseId, lesson.unitId, lesson.id)} type="button">
                <span className="font-semibold">{lesson.title}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{findCourseTitle(allLessons, courses, lesson.courseId)}</span>
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No matching lesson notes found.</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Courses</p>
        {courses.map((course) => (
          <button
            className={classNames("course-tab", course.id === selectedCourse.id && "course-tab-active")}
            key={course.id}
            onClick={() => onSelectCourse(course.id)}
            type="button"
          >
            <span>{course.shortTitle}</span>
            <span className="text-xs opacity-70">{course.units.flatMap((unit) => unit.lessons).length} lessons</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Course progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {selectedCourse.units.map((unit) => {
          const isOpen = expanded[unit.id] ?? unit.id === selectedUnit.id;
          return (
            <section key={unit.id}>
              <button className="unit-toggle" onClick={() => toggleUnit(unit.id)} type="button">
                <span>{unit.title}</span>
                <span>{isOpen ? "Hide" : "Show"}</span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div animate={{ height: "auto", opacity: 1 }} className="overflow-hidden" exit={{ height: 0, opacity: 0 }} initial={{ height: 0, opacity: 0 }}>
                    <div className="space-y-1 py-2">
                      {unit.lessons.map((lesson, index) => (
                        <button
                          className={classNames("lesson-link", lesson.id === selectedLesson.id && "lesson-link-active")}
                          key={lesson.id}
                          onClick={() => onSelectLesson(selectedCourse.id, unit.id, lesson.id)}
                          type="button"
                        >
                          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                          <span className="flex-1 text-left">{lesson.title}</span>
                          {progress.completed[lesson.id] && <span className="text-emerald-600 dark:text-emerald-300">Done</span>}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
    </nav>
  );
}

function CourseHero({
  cloudMessage,
  cloudState,
  course,
  lessonCount,
  progressPercent,
  role,
}: {
  cloudMessage: string;
  cloudState: string;
  course: Course;
  lessonCount: number;
  progressPercent: number;
  role: Role;
}) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 pb-6 dark:border-white/10 print:hidden">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">{course.status}</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">{course.title}</h2>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">{course.description}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{course.officialBasis}</p>
        </div>
        <div className="min-w-[220px] rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <p className="text-sm text-slate-500 dark:text-slate-400">Signed in as</p>
          <p className="text-lg font-semibold capitalize">{role}</p>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Progress</span>
            <span className="text-2xl font-semibold">{progressPercent}%</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{lessonCount} lessons in this course</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        <span className={classNames("mr-2 inline-block h-2 w-2 rounded-full", cloudState === "connected" ? "bg-emerald-500" : cloudState === "error" ? "bg-red-500" : "bg-amber-500")} />
        {cloudMessage}
      </div>
    </section>
  );
}

function Breadcrumbs({ course, lesson, unit }: { course: Course; lesson: Lesson; unit: Unit }) {
  return (
    <nav aria-label="Breadcrumb" className="mt-4 text-sm text-slate-500 dark:text-slate-400 print:hidden">
      <ol className="flex flex-wrap items-center gap-2">
        <li>{course.shortTitle}</li>
        <li>/</li>
        <li>{unit.title}</li>
        <li>/</li>
        <li className="font-semibold text-slate-800 dark:text-slate-100">{lesson.title}</li>
      </ol>
    </nav>
  );
}

function LessonActions({
  completed,
  favorite,
  lesson,
  onToggleCompleted,
  onToggleFavorite,
}: {
  completed: boolean;
  favorite: boolean;
  lesson: Lesson;
  onToggleCompleted: (lessonId: string) => void;
  onToggleFavorite: (lessonId: string) => void;
}) {
  const [pdfBusy, setPdfBusy] = useState(false);

  async function downloadPdf() {
    const element = document.getElementById("lesson-print-area");
    if (!element) return;
    setPdfBusy(true);
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const canvas = await html2canvas(element, { backgroundColor: "#ffffff", scale: 2 });
    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageHeight = (canvas.height * pageWidth) / canvas.width;
    let heightLeft = imageHeight;
    let position = 0;
    pdf.addImage(imageData, "PNG", 0, position, pageWidth, imageHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(imageData, "PNG", 0, position, pageWidth, imageHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(`${safeFileName(lesson.title)}.pdf`);
    setPdfBusy(false);
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2 print:hidden">
      <button className={classNames("action-button", completed && "action-button-on")} onClick={() => onToggleCompleted(lesson.id)} type="button">
        {completed ? "Completed" : "Mark complete"}
      </button>
      <button className={classNames("action-button", favorite && "action-button-on")} onClick={() => onToggleFavorite(lesson.id)} type="button">
        {favorite ? "Bookmarked" : "Bookmark"}
      </button>
      <button className="action-button" onClick={() => window.print()} type="button">
        Print notes
      </button>
      <button className="action-button" disabled={pdfBusy} onClick={downloadPdf} type="button">
        {pdfBusy ? "Building PDF..." : "Download PDF"}
      </button>
    </div>
  );
}

function LessonContent({ lesson }: { lesson: Lesson }) {
  if (lesson.customHtml) {
    return (
      <article className="lesson-paper" id="lesson-print-area">
        <LessonHeader lesson={lesson} />
        <CourseSourcePolicy courseId={lesson.courseId} />
        <div className="teacher-html" dangerouslySetInnerHTML={{ __html: lesson.customHtml }} />
        <References references={lesson.references} />
      </article>
    );
  }

  return (
    <article className="lesson-paper" id="lesson-print-area">
      <LessonHeader lesson={lesson} />
      <CourseSourcePolicy courseId={lesson.courseId} />

      <section className="lesson-section">
        <h3>Learning Objectives</h3>
        <BulletList items={lesson.objectives} />
      </section>

      <section className="lesson-section">
        <h3>Key Vocabulary</h3>
        <div className="overflow-x-auto">
          <table className="lesson-table">
            <thead>
              <tr>
                <th>Term</th>
                <th>Student-friendly meaning</th>
              </tr>
            </thead>
            <tbody>
              {lesson.vocabulary.map((item) => (
                <tr key={item.term}>
                  <td>{item.term}</td>
                  <td>{item.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lesson-section">
        <h3>Essential Concepts</h3>
        <BulletList items={lesson.concepts} />
      </section>

      <section className="callout important">
        <h3>Important Note</h3>
        <p>Strong cybersecurity explanations connect a specific asset, a weakness, a likely harm, and a control that directly reduces that harm.</p>
      </section>

      <section className="lesson-section">
        <h3>Step-by-Step Explanation</h3>
        <ol className="numbered-list">
          {lesson.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="lesson-section">
        <h3>Diagram</h3>
        <div className="diagram" aria-label={`${lesson.title} diagram`}>
          {lesson.diagram.map((node, index) => (
            <div className="diagram-node" key={`${node}-${index}`}>
              <span>{node}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lesson-section">
        <h3>Worked Example</h3>
        <p className="scenario">{lesson.workedExample.scenario}</p>
        <BulletList items={lesson.workedExample.analysis} />
      </section>

      {lesson.codeExample && (
        <section className="lesson-section">
          <h3>{lesson.codeExample.title}</h3>
          <pre className="code-block"><code>{lesson.codeExample.code}</code></pre>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{lesson.codeExample.explanation}</p>
        </section>
      )}

      <section className="callout warning">
        <h3>Common Mistakes</h3>
        <BulletList items={lesson.mistakes} />
      </section>

      <section className="callout tip">
        <h3>Exam Tips</h3>
        <BulletList items={lesson.examTips} />
      </section>

      <section className="lesson-section">
        <h3>Summary</h3>
        <p>{lesson.summary}</p>
      </section>

      <section className="lesson-section">
        <h3>Practice Questions</h3>
        <ol className="numbered-list">
          {lesson.practice.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
      </section>

      <section className="lesson-section">
        <h3>Resources</h3>
        <div className="resource-list">
          {lesson.resources.map((resource) => (
            <a href={resource.url} key={`${resource.label}-${resource.url}`} rel="noreferrer" target="_blank">
              {resource.label}
            </a>
          ))}
        </div>
      </section>

      <References references={lesson.references} />
    </article>
  );
}

function CourseSourcePolicy({ courseId }: { courseId: string }) {
  const policies: Record<string, { title: string; text: string; pillars: Array<{ label: string; detail: string }> }> = {
    "ap-cybersecurity": {
      title: "AP Cybersecurity Source Basis",
      text:
        "These AP Cybersecurity notes are original student-friendly summaries aligned to the College Board AP Cybersecurity course page, course audit requirements, and exam description information. Supporting explanations use reliable public cybersecurity resources from NIST, CISA, OWASP, and NIST NICE when a lesson needs definitions, controls, or industry context.",
      pillars: [
        { label: "Analyze Risk", detail: "Identify assets, threats, vulnerabilities, likelihood, impact, and evidence." },
        { label: "Mitigate Risk", detail: "Choose controls that directly reduce a stated weakness or impact." },
        { label: "Detect Attacks", detail: "Use logs, permissions, alerts, and artifacts to support conclusions." },
      ],
    },
    "ap-csp": {
      title: "AP CSP Source Basis",
      text:
        "These AP Computer Science Principles notes are original student-friendly summaries aligned to the latest College Board AP CSP course overview, CED structure, and AP Central exam information. Python documentation is used only as a reliable support reference for optional classroom code examples.",
      pillars: [
        { label: "Big Ideas", detail: "Creative development, data, algorithms, systems and networks, and impacts of computing." },
        { label: "Create Task", detail: "Purpose, input, output, list, procedure, algorithm, testing, and written response readiness." },
        { label: "Responsible Computing", detail: "Privacy, bias, access, security, intellectual property, and ethical impacts." },
      ],
    },
    "ap-csa": {
      title: "AP CSA Source Basis",
      text:
        "These AP Computer Science A notes are original student-friendly summaries aligned to the current four-unit College Board AP CSA framework. CSAwesome2 AP CSA Java 2025+ is used as the requested reliable curriculum support, and Oracle Java documentation supports Java API details.",
      pillars: [
        { label: "Current Units", detail: "Using Objects and Methods, Selection and Iteration, Class Creation, and Data Collections." },
        { label: "Java Skills", detail: "Design, develop, analyze, document, and responsibly use Java programs." },
        { label: "Exam Practice", detail: "Methods and control, class writing, ArrayList data analysis, and 2D array patterns." },
      ],
    },
  };

  const policy = policies[courseId];
  if (!policy) return null;

  return (
    <section className="callout important">
      <h3>{policy.title}</h3>
      <p>{policy.text}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {policy.pillars.map((pillar) => (
          <div key={pillar.label}>
            <p className="font-semibold">{pillar.label}</p>
            <p className="text-sm">{pillar.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LessonHeader({ lesson }: { lesson: Lesson }) {
  return (
    <header className="border-b border-slate-200 pb-5 dark:border-white/10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Lesson Notes</p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">{lesson.title}</h2>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Updated {lesson.updated} | Estimated time: {lesson.minutes} minutes</p>
    </header>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="bullet-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function References({ references }: { references: Reference[] }) {
  return (
    <section className="lesson-section">
      <h3>References</h3>
      <ul className="reference-list">
        {references.map((reference) => (
          <li key={`${reference.title}-${reference.url}`}>
            <a href={reference.url} rel="noreferrer" target="_blank">
              {reference.title}
            </a>
            <span> - {reference.publisher}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuickStudyPanel({
  allLessons,
  favorites,
  onSelectLesson,
  recent,
}: {
  allLessons: Lesson[];
  favorites: string[];
  onSelectLesson: (courseId: string, unitId: string, lessonId: string) => void;
  recent: string[];
}) {
  const favoriteLessons = favorites.map((id) => allLessons.find((lesson) => lesson.id === id)).filter(Boolean) as Lesson[];
  const recentLessons = recent.map((id) => allLessons.find((lesson) => lesson.id === id)).filter(Boolean) as Lesson[];

  return (
    <section className="side-panel">
      <h3>Quick Study</h3>
      <MiniLessonList empty="No favorites yet." lessons={favoriteLessons.slice(0, 5)} onSelectLesson={onSelectLesson} title="Bookmarks" />
      <MiniLessonList empty="No recently viewed lessons yet." lessons={recentLessons.slice(0, 5)} onSelectLesson={onSelectLesson} title="Recently viewed" />
    </section>
  );
}

function MiniLessonList({
  empty,
  lessons,
  onSelectLesson,
  title,
}: {
  empty: string;
  lessons: Lesson[];
  onSelectLesson: (courseId: string, unitId: string, lessonId: string) => void;
  title: string;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{title}</p>
      {lessons.length ? (
        <div className="mt-2 space-y-1">
          {lessons.map((lesson) => (
            <button className="mini-link" key={lesson.id} onClick={() => onSelectLesson(lesson.courseId, lesson.unitId, lesson.id)} type="button">
              {lesson.title}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{empty}</p>
      )}
    </div>
  );
}

function StudentToolsPanel({ exportNotes }: { exportNotes: () => void }) {
  return (
    <section className="side-panel">
      <h3>Student Tools</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Use lesson actions to print or download PDFs. Export creates a personal backup of the current portal notes.</p>
      <button className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold dark:border-white/15" onClick={exportNotes} type="button">
        Export Notes
      </button>
    </section>
  );
}

function DocsPanel() {
  return (
    <motion.section animate={{ opacity: 1, y: 0 }} className="side-panel" exit={{ opacity: 0, y: -8 }} initial={{ opacity: 0, y: -8 }}>
      <h3>Documentation</h3>
      <DocList items={projectDecisions.map((decision) => `${decision.label}: ${decision.decision}`)} title="Documented Decisions" />
      <DocList items={portalDocs.deployment} title="Deployment Guide" />
      <DocList items={portalDocs.teacherManual} title="Teacher Manual" />
      <DocList items={portalDocs.studentManual} title="Student Manual" />
      <DocList items={portalDocs.maintenance} title="Maintenance Guide" />
    </motion.section>
  );
}

function DocList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="mt-4">
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function TeacherTools({
  course,
  deleteLesson,
  importNotes,
  lesson,
  onAddLesson,
  onClose,
  onExport,
  onRestore,
  onUpdateLesson,
  unit,
}: {
  course: Course;
  deleteLesson: (lessonId: string) => void;
  importNotes: (file: File) => void;
  lesson: Lesson;
  onAddLesson: (courseId: string, unitId: string) => void;
  onClose: () => void;
  onExport: () => void;
  onRestore: () => void;
  onUpdateLesson: (lesson: Lesson, message?: string) => void;
  unit: Unit;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [editorHtml, setEditorHtml] = useState(lesson.draftHtml ?? lesson.customHtml ?? lessonToHtml(lesson));
  const [status, setStatus] = useState("Draft editor ready.");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(lesson.title);
    setEditorHtml(lesson.draftHtml ?? lesson.customHtml ?? lessonToHtml(lesson));
  }, [lesson]);

  function focusEditor() {
    editorRef.current?.focus();
  }

  function runCommand(command: string, value?: string) {
    focusEditor();
    document.execCommand(command, false, value);
    setEditorHtml(editorRef.current?.innerHTML ?? editorHtml);
  }

  function insertHtml(html: string) {
    focusEditor();
    document.execCommand("insertHTML", false, html);
    setEditorHtml(editorRef.current?.innerHTML ?? editorHtml);
  }

  function saveDraft() {
    const updated = { ...lesson, title, draftHtml: editorRef.current?.innerHTML ?? editorHtml, updated: today() };
    onUpdateLesson(updated, "Draft saved");
    setStatus("Draft saved. Students will not see it until you publish.");
  }

  function publishDraft() {
    const html = editorRef.current?.innerHTML ?? editorHtml;
    const updated = { ...lesson, title, customHtml: html, draftHtml: undefined, updated: today() };
    onUpdateLesson(updated, "Draft published");
    setStatus("Published. Students now see the updated lesson.");
  }

  async function insertUploadedFile(file: File, type: "image" | "pdf") {
    const result = await uploadPortalAsset(file);
    if (type === "image") {
      insertHtml(`<figure><img src="${result.url}" alt="${escapeHtml(file.name)}" /><figcaption>${escapeHtml(file.name)}</figcaption></figure>`);
    } else {
      insertHtml(`<p><a href="${result.url}" target="_blank" rel="noreferrer">PDF resource: ${escapeHtml(file.name)}</a></p>`);
    }
    setStatus(result.message);
  }

  function insertVideo() {
    const url = window.prompt("Paste a YouTube, Vimeo, or video URL");
    if (!url) return;
    const safeUrl = escapeHtml(toEmbedUrl(url));
    insertHtml(`<div class="video-embed"><iframe src="${safeUrl}" title="Embedded video" allowfullscreen></iframe></div>`);
  }

  function insertLink() {
    const url = window.prompt("Paste the link URL");
    if (!url) return;
    const label = window.prompt("Link text") ?? url;
    insertHtml(`<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`);
  }

  return (
    <motion.aside
      animate={{ x: 0 }}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0b1c32] print:hidden"
      exit={{ x: "100%" }}
      initial={{ x: "100%" }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <header className="border-b border-slate-200 p-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Draft and Publish</p>
            <h2 className="text-2xl font-semibold">Teacher Tools</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{course.shortTitle} | {unit.title}</p>
          </div>
          <button className="toolbar-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <label className="text-sm font-semibold" htmlFor="lesson-title-editor">
          Lesson title
        </label>
        <input
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-300/25 dark:border-white/10 dark:bg-white/8"
          id="lesson-title-editor"
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="editor-button" onClick={() => runCommand("bold")} type="button">Bold</button>
          <button className="editor-button" onClick={() => runCommand("italic")} type="button">Italic</button>
          <button className="editor-button" onClick={() => runCommand("formatBlock", "h3")} type="button">Heading</button>
          <button className="editor-button" onClick={() => runCommand("insertUnorderedList")} type="button">Bullets</button>
          <button className="editor-button" onClick={() => runCommand("insertOrderedList")} type="button">Numbered</button>
          <button className="editor-button" onClick={insertLink} type="button">Link</button>
          <button className="editor-button" onClick={() => insertHtml("<pre><code>// Add code here</code></pre>")} type="button">Code</button>
          <button className="editor-button" onClick={() => insertHtml("<div class='teacher-diagram'><span>Idea</span><span>Risk</span><span>Control</span><span>Evidence</span></div>")} type="button">Diagram</button>
          <button className="editor-button" onClick={insertVideo} type="button">Video</button>
          <label className="editor-button cursor-pointer">
            Image
            <input accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && insertUploadedFile(event.target.files[0], "image")} type="file" />
          </label>
          <label className="editor-button cursor-pointer">
            PDF
            <input accept="application/pdf" className="hidden" onChange={(event) => event.target.files?.[0] && insertUploadedFile(event.target.files[0], "pdf")} type="file" />
          </label>
        </div>

        <div
          aria-label="Rich text lesson editor"
          className="teacher-editor mt-4"
          contentEditable
          dangerouslySetInnerHTML={{ __html: editorHtml }}
          onInput={(event) => setEditorHtml(event.currentTarget.innerHTML)}
          ref={editorRef}
          suppressContentEditableWarning
          tabIndex={0}
        />

        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-300/10 dark:text-amber-100">{status}</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button className="teacher-primary" onClick={saveDraft} type="button">Save Draft</button>
          <button className="teacher-primary" onClick={publishDraft} type="button">Publish Draft</button>
          <button className="teacher-secondary" onClick={() => onAddLesson(course.id, unit.id)} type="button">Add Lesson</button>
          <button className="teacher-secondary" onClick={() => deleteLesson(lesson.id)} type="button">Delete Lesson</button>
          <button className="teacher-secondary" onClick={onExport} type="button">Backup / Export</button>
          <label className="teacher-secondary cursor-pointer text-center">
            Import Notes
            <input accept="application/json" className="hidden" onChange={(event) => event.target.files?.[0] && importNotes(event.target.files[0])} type="file" />
          </label>
          <button className="teacher-secondary sm:col-span-2" onClick={onRestore} type="button">Restore Official Phase 1 Content</button>
        </div>
      </div>
    </motion.aside>
  );
}

function SkipLink() {
  return (
    <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-amber-300 focus:px-4 focus:py-2 focus:text-slate-950" href="#main-content">
      Skip to main content
    </a>
  );
}

function flattenLessons(courses: Course[]) {
  return courses.flatMap((course) => course.units.flatMap((unit) => unit.lessons));
}

function lessonSearchText(lesson: Lesson) {
  return [
    lesson.title,
    lesson.objectives.join(" "),
    lesson.vocabulary.map((item) => `${item.term} ${item.definition}`).join(" "),
    lesson.concepts.join(" "),
    lesson.steps.join(" "),
    lesson.summary,
    lesson.customHtml ? stripHtml(lesson.customHtml) : "",
  ]
    .join(" ")
    .toLowerCase();
}

function findCourseTitle(allLessons: Lesson[], courses: Course[], courseId: string) {
  const course = courses.find((item) => item.id === courseId);
  return course?.shortTitle ?? allLessons.find((lesson) => lesson.courseId === courseId)?.courseId ?? "Course";
}

function stripHtml(html: string) {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent ?? element.innerText ?? "";
}

function lessonToHtml(lesson: Lesson) {
  return `
    <h3>Learning Objectives</h3>
    <ul>${lesson.objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <h3>Key Vocabulary</h3>
    <ul>${lesson.vocabulary.map((item) => `<li><strong>${escapeHtml(item.term)}:</strong> ${escapeHtml(item.definition)}</li>`).join("")}</ul>
    <h3>Essential Concepts</h3>
    <ul>${lesson.concepts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <h3>Step-by-Step Explanation</h3>
    <ol>${lesson.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    <h3>Worked Example</h3>
    <p>${escapeHtml(lesson.workedExample.scenario)}</p>
    <ul>${lesson.workedExample.analysis.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    ${lesson.codeExample ? `<h3>${escapeHtml(lesson.codeExample.title)}</h3><pre><code>${escapeHtml(lesson.codeExample.code)}</code></pre><p>${escapeHtml(lesson.codeExample.explanation)}</p>` : ""}
    <h3>Common Mistakes</h3>
    <ul>${lesson.mistakes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <h3>Exam Tips</h3>
    <ul>${lesson.examTips.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <h3>Summary</h3>
    <p>${escapeHtml(lesson.summary)}</p>
    <h3>Practice Questions</h3>
    <ol>${lesson.practice.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
  `;
}

function createTeacherLesson(id: string, courseId: string, unitId: string): Lesson {
  return {
    id,
    courseId,
    unitId,
    title: "New Teacher Lesson",
    minutes: 45,
    updated: today(),
    objectives: ["Add the learning objectives for this lesson."],
    vocabulary: [{ term: "New term", definition: "Add a student-friendly definition." }],
    concepts: ["Add the essential concepts students need to understand."],
    steps: ["Add a step-by-step explanation."],
    workedExample: { scenario: "Add a realistic scenario.", analysis: ["Add the worked example analysis."] },
    mistakes: ["Add common mistakes."],
    examTips: ["Add exam tips."],
    summary: "Add a concise lesson summary.",
    practice: ["Add a practice question."],
    references: [],
    resources: [],
    diagram: ["Idea", "Example", "Practice", "Review"],
    draftHtml: "<h3>Learning Objectives</h3><ul><li>Add objectives here.</li></ul><h3>Notes</h3><p>Start writing the lesson here.</p>",
  };
}

function downloadJson(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "lesson";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com") && parsed.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get("v")}`;
    }
    if (parsed.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}`;
    }
    return url;
  } catch {
    return url;
  }
}

function mergeUpdatedSeedCourses(savedCourses: Course[]) {
  const seedLessonCounts = Object.fromEntries(seedCourses.map((course) => [course.id, course.units.flatMap((unit) => unit.lessons).length]));
  const savedById = new Map(savedCourses.map((course) => [course.id, course]));

  return seedCourses.map((seedCourse) => {
    const savedCourse = savedById.get(seedCourse.id);
    if (!savedCourse) return seedCourse;

    const savedLessonCount = savedCourse.units.flatMap((unit) => unit.lessons).length;
    const seedLessonCount = seedLessonCounts[seedCourse.id] ?? 0;

    if ((seedCourse.id === "ap-csp" || seedCourse.id === "ap-csa") && savedLessonCount < seedLessonCount) {
      return seedCourse;
    }

    return savedCourse;
  });
}

export default App;