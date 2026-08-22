import React, {
  useState,
  useEffect,
  useContext,
  createContext,
  useCallback,
  type ReactNode,
} from "react";
import {
  Users,
  Clock,
  Calendar,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  Check,
  X,
  Plus,
  Search,
  Edit,
  Eye,
  Download,
  TrendingUp,
  DollarSign,
  UserCheck,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  ChevronRight,
  Home,
  ArrowLeft,
  Save,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building,
  Lock,
  Filter,
  MoreHorizontal,
  User,
  FileText,
  RefreshCw,
  ChevronLeft,
  CreditCard,
  Menu,
  BarChart2,
  UserPlus,
  Layers,
} from "lucide-react";

// ─── TYPES ───────────────────────────────────────────────────────────────────

type Role = "employee" | "admin";
type AttStatus = "present" | "absent" | "late" | "half-day" | "weekend" | "holiday";
type LeaveStatus = "pending" | "approved" | "rejected";
type LeaveType = "annual" | "sick" | "personal" | "maternity" | "paternity" | "unpaid";
type NotifType = "info" | "success" | "warning" | "error";
type SalaryStatus = "paid" | "pending" | "processing";
type EmpStatus = "active" | "inactive";

interface Employee {
  id: string;
  email: string;
  password: string;
  role: Role;
  name: string;
  initials: string;
  department: string;
  position: string;
  phone: string;
  address: string;
  joinDate: string;
  employeeId: string;
  manager: string;
  status: EmpStatus;
  avatarColor: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttStatus;
  hours: number;
  notes: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  reviewedBy: string | null;
  reviewedOn: string | null;
  comment: string;
}

interface SalaryRecord {
  id: string;
  employeeId: string;
  month: string;
  basicSalary: number;
  bonus: number;
  allowances: number;
  deductions: number;
  tax: number;
  netSalary: number;
  status: SalaryStatus;
  paidOn: string | null;
}

interface SalaryConfig {
  employeeId: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  medicalAllowance: number;
  taxRate: number;
  insuranceDeduction: number;
  pensionDeduction: number;
  bonus: number;
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotifType;
  read: boolean;
  createdAt: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmtDate = (d: Date) => d.toISOString().split("T")[0];
const today = fmtDate(new Date());

const getDay = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return fmtDate(d);
};

const isWeekend = (dateStr: string): boolean => {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
};

const monthStr = (offset: number): string => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const formatCurrency = (n: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const formatDateShort = (s: string): string =>
  new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatMonthLabel = (m: string): string => {
  const [year, month] = m.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const nowTime = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const uid = (): string => Math.random().toString(36).slice(2, 10);

const seeded = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return (h >>> 0) / 0xffffffff;
};

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<string, string> = {
  "emp-001": "#7C3AED",
  "emp-002": "#0891B2",
  "emp-003": "#DB2777",
  "emp-004": "#D97706",
  "emp-005": "#059669",
  "emp-006": "#4338CA",
  "emp-007": "#DC2626",
  "emp-008": "#0D9488",
};

const INIT_EMPLOYEES: Employee[] = [
  {
    id: "emp-001", email: "employee@dayflow.com", password: "employee123",
    role: "employee", name: "Sarah Johnson", initials: "SJ",
    department: "Engineering", position: "Software Engineer",
    phone: "+1 (555) 234-5678", address: "123 Oak Street, San Francisco, CA 94102",
    joinDate: "2022-03-15", employeeId: "DF-0001", manager: "Michael Chen",
    status: "active", avatarColor: AVATAR_COLORS["emp-001"],
  },
  {
    id: "emp-002", email: "admin@dayflow.com", password: "admin123",
    role: "admin", name: "Michael Chen", initials: "MC",
    department: "Human Resources", position: "HR Manager",
    phone: "+1 (555) 345-6789", address: "456 Pine Avenue, San Francisco, CA 94103",
    joinDate: "2020-01-10", employeeId: "DF-0002", manager: "—",
    status: "active", avatarColor: AVATAR_COLORS["emp-002"],
  },
  {
    id: "emp-003", email: "emily.r@dayflow.com", password: "emily123",
    role: "employee", name: "Emily Rodriguez", initials: "ER",
    department: "Design", position: "Product Designer",
    phone: "+1 (555) 456-7890", address: "789 Maple Drive, Oakland, CA 94601",
    joinDate: "2021-06-01", employeeId: "DF-0003", manager: "Michael Chen",
    status: "active", avatarColor: AVATAR_COLORS["emp-003"],
  },
  {
    id: "emp-004", email: "james.w@dayflow.com", password: "james123",
    role: "employee", name: "James Wilson", initials: "JW",
    department: "Marketing", position: "Marketing Manager",
    phone: "+1 (555) 567-8901", address: "321 Cedar Lane, Berkeley, CA 94710",
    joinDate: "2021-09-20", employeeId: "DF-0004", manager: "Michael Chen",
    status: "active", avatarColor: AVATAR_COLORS["emp-004"],
  },
  {
    id: "emp-005", email: "aisha.p@dayflow.com", password: "aisha123",
    role: "employee", name: "Aisha Patel", initials: "AP",
    department: "Engineering", position: "Backend Developer",
    phone: "+1 (555) 678-9012", address: "654 Birch Blvd, San Jose, CA 95101",
    joinDate: "2022-11-14", employeeId: "DF-0005", manager: "Sarah Johnson",
    status: "active", avatarColor: AVATAR_COLORS["emp-005"],
  },
  {
    id: "emp-006", email: "david.k@dayflow.com", password: "david123",
    role: "employee", name: "David Kim", initials: "DK",
    department: "Engineering", position: "Frontend Developer",
    phone: "+1 (555) 789-0123", address: "987 Walnut Way, Palo Alto, CA 94301",
    joinDate: "2023-02-28", employeeId: "DF-0006", manager: "Sarah Johnson",
    status: "active", avatarColor: AVATAR_COLORS["emp-006"],
  },
  {
    id: "emp-007", email: "rachel.t@dayflow.com", password: "rachel123",
    role: "employee", name: "Rachel Torres", initials: "RT",
    department: "Sales", position: "Sales Representative",
    phone: "+1 (555) 890-1234", address: "246 Elm Street, Mountain View, CA 94040",
    joinDate: "2023-05-10", employeeId: "DF-0007", manager: "James Wilson",
    status: "active", avatarColor: AVATAR_COLORS["emp-007"],
  },
  {
    id: "emp-008", email: "marcus.b@dayflow.com", password: "marcus123",
    role: "employee", name: "Marcus Brown", initials: "MB",
    department: "Engineering", position: "DevOps Engineer",
    phone: "+1 (555) 901-2345", address: "135 Spruce Court, Sunnyvale, CA 94086",
    joinDate: "2022-08-01", employeeId: "DF-0008", manager: "Sarah Johnson",
    status: "inactive", avatarColor: AVATAR_COLORS["emp-008"],
  },
];

const INIT_SALARY_CONFIGS: SalaryConfig[] = [
  { employeeId: "emp-001", basicSalary: 8500, housingAllowance: 1200, transportAllowance: 300, medicalAllowance: 250, taxRate: 22, insuranceDeduction: 180, pensionDeduction: 255, bonus: 500 },
  { employeeId: "emp-002", basicSalary: 11000, housingAllowance: 1800, transportAllowance: 400, medicalAllowance: 350, taxRate: 28, insuranceDeduction: 220, pensionDeduction: 330, bonus: 1000 },
  { employeeId: "emp-003", basicSalary: 7800, housingAllowance: 1000, transportAllowance: 250, medicalAllowance: 200, taxRate: 20, insuranceDeduction: 156, pensionDeduction: 234, bonus: 400 },
  { employeeId: "emp-004", basicSalary: 9200, housingAllowance: 1400, transportAllowance: 350, medicalAllowance: 300, taxRate: 24, insuranceDeduction: 184, pensionDeduction: 276, bonus: 600 },
  { employeeId: "emp-005", basicSalary: 7500, housingAllowance: 900, transportAllowance: 250, medicalAllowance: 200, taxRate: 20, insuranceDeduction: 150, pensionDeduction: 225, bonus: 300 },
  { employeeId: "emp-006", basicSalary: 6800, housingAllowance: 800, transportAllowance: 200, medicalAllowance: 150, taxRate: 18, insuranceDeduction: 136, pensionDeduction: 204, bonus: 250 },
  { employeeId: "emp-007", basicSalary: 6200, housingAllowance: 700, transportAllowance: 200, medicalAllowance: 150, taxRate: 18, insuranceDeduction: 124, pensionDeduction: 186, bonus: 800 },
  { employeeId: "emp-008", basicSalary: 8000, housingAllowance: 1100, transportAllowance: 300, medicalAllowance: 250, taxRate: 22, insuranceDeduction: 160, pensionDeduction: 240, bonus: 0 },
];

const buildSalaryRecord = (cfg: SalaryConfig, month: string, status: SalaryStatus, paidOn: string | null): SalaryRecord => {
  const allowances = cfg.housingAllowance + cfg.transportAllowance + cfg.medicalAllowance;
  const gross = cfg.basicSalary + allowances + cfg.bonus;
  const tax = Math.round(gross * cfg.taxRate / 100);
  const deductions = cfg.insuranceDeduction + cfg.pensionDeduction;
  const net = gross - tax - deductions;
  return {
    id: uid(),
    employeeId: cfg.employeeId,
    month,
    basicSalary: cfg.basicSalary,
    bonus: cfg.bonus,
    allowances,
    deductions,
    tax,
    netSalary: net,
    status,
    paidOn,
  };
};

const generateSalaryRecords = (): SalaryRecord[] => {
  const records: SalaryRecord[] = [];
  INIT_SALARY_CONFIGS.forEach((cfg) => {
    for (let i = 5; i >= 1; i--) {
      const m = monthStr(i);
      records.push(buildSalaryRecord(cfg, m, "paid", getDay(i * 3 + 1)));
    }
    records.push(buildSalaryRecord(cfg, monthStr(0), "pending", null));
  });
  return records;
};

const generateAttendance = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  INIT_EMPLOYEES.forEach((emp) => {
    for (let i = 30; i >= 1; i--) {
      const date = getDay(i);
      if (isWeekend(date)) {
        records.push({ id: uid(), employeeId: emp.id, date, checkIn: null, checkOut: null, status: "weekend", hours: 0, notes: "" });
        continue;
      }
      const r = seeded(emp.id + date);
      let status: AttStatus;
      let checkIn: string | null = null;
      let checkOut: string | null = null;
      let hours = 0;
      if (r < 0.68) {
        status = "present";
        const ciM = Math.floor(seeded(emp.id + date + "ci") * 30) + 510;
        const coM = Math.floor(seeded(emp.id + date + "co") * 60) + 1020;
        checkIn = `${String(Math.floor(ciM / 60)).padStart(2, "0")}:${String(ciM % 60).padStart(2, "0")}`;
        checkOut = `${String(Math.floor(coM / 60)).padStart(2, "0")}:${String(coM % 60).padStart(2, "0")}`;
        hours = Math.round((coM - ciM) / 60 * 10) / 10;
      } else if (r < 0.82) {
        status = "late";
        const ciM = Math.floor(seeded(emp.id + date + "ci") * 60) + 570;
        const coM = Math.floor(seeded(emp.id + date + "co") * 60) + 1020;
        checkIn = `${String(Math.floor(ciM / 60)).padStart(2, "0")}:${String(ciM % 60).padStart(2, "0")}`;
        checkOut = `${String(Math.floor(coM / 60)).padStart(2, "0")}:${String(coM % 60).padStart(2, "0")}`;
        hours = Math.round((coM - ciM) / 60 * 10) / 10;
      } else if (r < 0.92) {
        status = "absent";
      } else {
        status = "half-day";
        checkIn = "09:00"; checkOut = "13:00"; hours = 4;
      }
      records.push({ id: uid(), employeeId: emp.id, date, checkIn, checkOut, status, hours, notes: "" });
    }
  });
  return records;
};

const INIT_LEAVES: LeaveRequest[] = [
  { id: uid(), employeeId: "emp-001", type: "annual", startDate: getDay(10), endDate: getDay(8), days: 3, reason: "Family vacation", status: "approved", appliedOn: getDay(20), reviewedBy: "emp-002", reviewedOn: getDay(18), comment: "Approved. Enjoy your vacation!" },
  { id: uid(), employeeId: "emp-003", type: "sick", startDate: getDay(3), endDate: getDay(2), days: 2, reason: "Flu and fever", status: "approved", appliedOn: getDay(4), reviewedBy: "emp-002", reviewedOn: getDay(4), comment: "Get well soon." },
  { id: uid(), employeeId: "emp-004", type: "personal", startDate: getDay(1), endDate: getDay(1), days: 1, reason: "Medical appointment", status: "approved", appliedOn: getDay(5), reviewedBy: "emp-002", reviewedOn: getDay(4), comment: "" },
  { id: uid(), employeeId: "emp-005", type: "annual", startDate: getDay(-5), endDate: getDay(-3), days: 3, reason: "Short trip", status: "pending", appliedOn: getDay(2), reviewedBy: null, reviewedOn: null, comment: "" },
  { id: uid(), employeeId: "emp-006", type: "sick", startDate: getDay(-2), endDate: getDay(-2), days: 1, reason: "Not feeling well", status: "pending", appliedOn: getDay(1), reviewedBy: null, reviewedOn: null, comment: "" },
  { id: uid(), employeeId: "emp-001", type: "personal", startDate: getDay(-7), endDate: getDay(-6), days: 2, reason: "Personal errands", status: "pending", appliedOn: today, reviewedBy: null, reviewedOn: null, comment: "" },
  { id: uid(), employeeId: "emp-007", type: "annual", startDate: getDay(25), endDate: getDay(21), days: 5, reason: "Holiday travel", status: "rejected", appliedOn: getDay(30), reviewedBy: "emp-002", reviewedOn: getDay(28), comment: "Short notice — please plan earlier." },
];

const INIT_NOTIFICATIONS: Notification[] = [
  { id: uid(), userId: "emp-001", title: "Leave Approved", message: "Your annual leave request for 3 days has been approved.", type: "success", read: false, createdAt: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: uid(), userId: "emp-001", title: "Salary Processed", message: "Your salary for last month has been processed and will be credited shortly.", type: "info", read: false, createdAt: new Date(Date.now() - 3600000 * 24).toISOString() },
  { id: uid(), userId: "emp-001", title: "Policy Update", message: "The remote work policy has been updated. Please review the changes.", type: "warning", read: true, createdAt: new Date(Date.now() - 3600000 * 48).toISOString() },
  { id: uid(), userId: "emp-002", title: "Leave Request Pending", message: "Aisha Patel has submitted a leave request for 3 days. Review required.", type: "warning", read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: uid(), userId: "emp-002", title: "Leave Request Pending", message: "David Kim has submitted a sick leave request for 1 day. Review required.", type: "warning", read: false, createdAt: new Date(Date.now() - 3600000 * 3).toISOString() },
  { id: uid(), userId: "emp-002", title: "New Employee Onboarding", message: "Rachel Torres has completed onboarding. All documents are verified.", type: "success", read: true, createdAt: new Date(Date.now() - 3600000 * 72).toISOString() },
  { id: uid(), userId: "emp-002", title: "Payroll Reminder", message: "Monthly payroll for current month is due for processing by end of week.", type: "info", read: true, createdAt: new Date(Date.now() - 3600000 * 96).toISOString() },
  { id: uid(), userId: "emp-003", title: "Leave Approved", message: "Your sick leave for 2 days has been approved. Rest well!", type: "success", read: false, createdAt: new Date(Date.now() - 3600000 * 5).toISOString() },
];

// ─── STORAGE ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "dayflow_hrms_v2";

interface StoredData {
  employees: Employee[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  salaryRecords: SalaryRecord[];
  salaryConfigs: SalaryConfig[];
  notifications: Notification[];
}

const loadData = (): StoredData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredData;
  } catch {}
  const fresh: StoredData = {
    employees: INIT_EMPLOYEES,
    attendance: generateAttendance(),
    leaves: INIT_LEAVES,
    salaryRecords: generateSalaryRecords(),
    salaryConfigs: INIT_SALARY_CONFIGS,
    notifications: INIT_NOTIFICATIONS,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
};

const saveData = (d: StoredData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
};

// ─── CONTEXT ─────────────────────────────────────────────────────────────────

interface NavParams { employeeId?: string; month?: string }

interface AppCtxType {
  currentUser: Employee | null;
  page: string;
  navParams: NavParams;
  employees: Employee[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  salaryRecords: SalaryRecord[];
  salaryConfigs: SalaryConfig[];
  notifications: Notification[];

  signIn: (email: string, password: string) => string | null;
  signOut: () => void;
  signUp: (data: { name: string; email: string; password: string; department: string; position: string }) => string | null;

  navigate: (p: string, params?: NavParams) => void;

  checkIn: (employeeId: string) => void;
  checkOut: (employeeId: string) => void;

  submitLeave: (data: Omit<LeaveRequest, "id" | "status" | "appliedOn" | "reviewedBy" | "reviewedOn" | "comment">) => void;
  reviewLeave: (id: string, status: LeaveStatus, comment: string, reviewerId: string) => void;
  cancelLeave: (id: string) => void;

  updateEmployee: (emp: Employee) => void;
  addEmployee: (emp: Employee) => void;

  updateSalaryConfig: (cfg: SalaryConfig) => void;
  markSalaryPaid: (id: string) => void;

  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  addNotification: (n: Omit<Notification, "id" | "createdAt">) => void;

  updateCurrentUser: (data: Partial<Employee>) => void;
}

const AppCtx = createContext<AppCtxType | null>(null);

const useApp = () => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
};

function AppProvider({ children }: { children: ReactNode }) {
  const stored = loadData();

  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    const id = sessionStorage.getItem("dayflow_user");
    return id ? (stored.employees.find((e) => e.id === id) ?? null) : null;
  });
  const [page, setPage] = useState<string>(() => {
    const id = sessionStorage.getItem("dayflow_user");
    if (!id) return "signin";
    const u = stored.employees.find((e) => e.id === id);
    return u ? (u.role === "admin" ? "admin-dashboard" : "emp-dashboard") : "signin";
  });
  const [navParams, setNavParams] = useState<NavParams>({});
  const [employees, setEmployees] = useState<Employee[]>(stored.employees);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(stored.attendance);
  const [leaves, setLeaves] = useState<LeaveRequest[]>(stored.leaves);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>(stored.salaryRecords);
  const [salaryConfigs, setSalaryConfigs] = useState<SalaryConfig[]>(stored.salaryConfigs);
  const [notifications, setNotifications] = useState<Notification[]>(stored.notifications);

  const persist = useCallback((updates: Partial<StoredData>) => {
    const current = loadData();
    const merged = { ...current, ...updates };
    saveData(merged);
  }, []);

  useEffect(() => { persist({ employees }); }, [employees]);
  useEffect(() => { persist({ attendance }); }, [attendance]);
  useEffect(() => { persist({ leaves }); }, [leaves]);
  useEffect(() => { persist({ salaryRecords }); }, [salaryRecords]);
  useEffect(() => { persist({ salaryConfigs }); }, [salaryConfigs]);
  useEffect(() => { persist({ notifications }); }, [notifications]);

  const navigate = useCallback((p: string, params: NavParams = {}) => {
    setPage(p);
    setNavParams(params);
  }, []);

  const signIn = useCallback((email: string, password: string): string | null => {
    const emp = employees.find((e) => e.email.toLowerCase() === email.toLowerCase() && e.password === password);
    if (!emp) return "Invalid email or password.";
    setCurrentUser(emp);
    sessionStorage.setItem("dayflow_user", emp.id);
    navigate(emp.role === "admin" ? "admin-dashboard" : "emp-dashboard");
    return null;
  }, [employees, navigate]);

  const signOut = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem("dayflow_user");
    navigate("signin");
  }, [navigate]);

  const signUp = useCallback((data: { name: string; email: string; password: string; department: string; position: string }): string | null => {
    if (employees.find((e) => e.email.toLowerCase() === data.email.toLowerCase())) {
      return "An account with this email already exists.";
    }
    const newId = `emp-${String(Date.now()).slice(-5)}`;
    const initials = data.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const colors = ["#7C3AED", "#0891B2", "#059669", "#D97706", "#DB2777", "#4338CA", "#0D9488"];
    const newEmp: Employee = {
      id: newId,
      email: data.email,
      password: data.password,
      role: "employee",
      name: data.name,
      initials,
      department: data.department,
      position: data.position,
      phone: "",
      address: "",
      joinDate: today,
      employeeId: `DF-${String(employees.length + 1).padStart(4, "0")}`,
      manager: "Michael Chen",
      status: "active",
      avatarColor: colors[employees.length % colors.length],
    };
    const defaultConfig: SalaryConfig = {
      employeeId: newId,
      basicSalary: 5000, housingAllowance: 500, transportAllowance: 150,
      medicalAllowance: 100, taxRate: 18, insuranceDeduction: 100,
      pensionDeduction: 150, bonus: 0,
    };
    setEmployees((prev) => [...prev, newEmp]);
    setSalaryConfigs((prev) => [...prev, defaultConfig]);
    setCurrentUser(newEmp);
    sessionStorage.setItem("dayflow_user", newEmp.id);
    navigate("emp-dashboard");
    return null;
  }, [employees, navigate]);

  const checkIn = useCallback((employeeId: string) => {
    const existing = attendance.find((a) => a.employeeId === employeeId && a.date === today);
    const time = nowTime();
    const [h, m] = time.split(":").map(Number);
    const late = h > 9 || (h === 9 && m > 15);
    if (existing) {
      setAttendance((prev) => prev.map((a) =>
        a.id === existing.id ? { ...a, checkIn: time, status: late ? "late" : "present" } : a
      ));
    } else {
      setAttendance((prev) => [...prev, {
        id: uid(), employeeId, date: today,
        checkIn: time, checkOut: null,
        status: late ? "late" : "present", hours: 0, notes: "",
      }]);
    }
  }, [attendance]);

  const checkOut = useCallback((employeeId: string) => {
    const existing = attendance.find((a) => a.employeeId === employeeId && a.date === today);
    const time = nowTime();
    if (existing?.checkIn) {
      const [ih, im] = existing.checkIn.split(":").map(Number);
      const [oh, om] = time.split(":").map(Number);
      const hours = Math.round(((oh * 60 + om) - (ih * 60 + im)) / 60 * 10) / 10;
      setAttendance((prev) => prev.map((a) =>
        a.id === existing.id ? { ...a, checkOut: time, hours } : a
      ));
    }
  }, [attendance]);

  const submitLeave = useCallback((data: Omit<LeaveRequest, "id" | "status" | "appliedOn" | "reviewedBy" | "reviewedOn" | "comment">) => {
    const req: LeaveRequest = {
      ...data, id: uid(), status: "pending",
      appliedOn: today, reviewedBy: null, reviewedOn: null, comment: "",
    };
    setLeaves((prev) => [req, ...prev]);
    const emp = employees.find((e) => e.id === data.employeeId);
    setNotifications((prev) => [{
      id: uid(), userId: "emp-002",
      title: "New Leave Request",
      message: `${emp?.name ?? "An employee"} submitted a ${data.type} leave request for ${data.days} day(s).`,
      type: "warning", read: false, createdAt: new Date().toISOString(),
    }, ...prev]);
  }, [employees]);

  const reviewLeave = useCallback((id: string, status: LeaveStatus, comment: string, reviewerId: string) => {
    setLeaves((prev) => prev.map((l) =>
      l.id === id ? { ...l, status, comment, reviewedBy: reviewerId, reviewedOn: today } : l
    ));
    const leave = leaves.find((l) => l.id === id);
    if (leave) {
      setNotifications((prev) => [{
        id: uid(), userId: leave.employeeId,
        title: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Your ${leave.type} leave request has been ${status}${comment ? `: "${comment}"` : "."}`,
        type: status === "approved" ? "success" : "error",
        read: false, createdAt: new Date().toISOString(),
      }, ...prev]);
    }
  }, [leaves]);

  const cancelLeave = useCallback((id: string) => {
    setLeaves((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const updateEmployee = useCallback((emp: Employee) => {
    setEmployees((prev) => prev.map((e) => e.id === emp.id ? emp : e));
    if (currentUser?.id === emp.id) setCurrentUser(emp);
  }, [currentUser]);

  const addEmployee = useCallback((emp: Employee) => {
    setEmployees((prev) => [...prev, emp]);
    const defaultConfig: SalaryConfig = {
      employeeId: emp.id,
      basicSalary: 5000, housingAllowance: 500, transportAllowance: 150,
      medicalAllowance: 100, taxRate: 18, insuranceDeduction: 100,
      pensionDeduction: 150, bonus: 0,
    };
    setSalaryConfigs((prev) => [...prev, defaultConfig]);
  }, []);

  const updateSalaryConfig = useCallback((cfg: SalaryConfig) => {
    setSalaryConfigs((prev) => prev.map((c) => c.employeeId === cfg.employeeId ? cfg : c));
  }, []);

  const markSalaryPaid = useCallback((id: string) => {
    setSalaryRecords((prev) => prev.map((s) =>
      s.id === id ? { ...s, status: "paid" as SalaryStatus, paidOn: today } : s
    ));
    const rec = salaryRecords.find((s) => s.id === id);
    if (rec) {
      setNotifications((prev) => [{
        id: uid(), userId: rec.employeeId,
        title: "Salary Credited",
        message: `Your salary of ${formatCurrency(rec.netSalary)} for ${formatMonthLabel(rec.month)} has been credited.`,
        type: "success", read: false, createdAt: new Date().toISOString(),
      }, ...prev]);
    }
  }, [salaryRecords]);

  const markNotifRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllNotifsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const addNotification = useCallback((n: Omit<Notification, "id" | "createdAt">) => {
    setNotifications((prev) => [{ ...n, id: uid(), createdAt: new Date().toISOString() }, ...prev]);
  }, []);

  const updateCurrentUser = useCallback((data: Partial<Employee>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...data };
    setCurrentUser(updated);
    setEmployees((prev) => prev.map((e) => e.id === updated.id ? updated : e));
  }, [currentUser]);

  const value: AppCtxType = {
    currentUser, page, navParams, employees, attendance, leaves,
    salaryRecords, salaryConfigs, notifications,
    signIn, signOut, signUp, navigate,
    checkIn, checkOut, submitLeave, reviewLeave, cancelLeave,
    updateEmployee, addEmployee, updateSalaryConfig, markSalaryPaid,
    markNotifRead, markAllNotifsRead, addNotification, updateCurrentUser,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────

const Btn = ({
  variant = "primary", size = "md", children, onClick, disabled, className = "", type = "button", fullWidth,
}: {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  children: ReactNode; onClick?: () => void; disabled?: boolean;
  className?: string; type?: "button" | "submit" | "reset"; fullWidth?: boolean;
}) => {
  const v = {
    primary: "bg-purple-600 hover:bg-purple-700 text-white shadow-sm",
    secondary: "bg-purple-100 hover:bg-purple-200 text-purple-700",
    outline: "border border-gray-300 hover:bg-gray-50 text-gray-700 bg-white",
    ghost: "hover:bg-gray-100 text-gray-600",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-sm",
    success: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm",
  }[variant];
  const s = { xs: "px-2 py-1 text-xs", sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-base" }[size];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${v} ${s} ${fullWidth ? "w-full" : ""} ${className}`}>
      {children}
    </button>
  );
};

const Badge = ({ variant = "default", children }: {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple" | "gray";
  children: ReactNode;
}) => {
  const v = {
    default: "bg-gray-100 text-gray-600",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    gray: "bg-gray-100 text-gray-500",
  }[variant];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${v}`}>{children}</span>;
};

const AvatarCircle = ({ initials, color, size = "md" }: { initials: string; color: string; size?: "xs" | "sm" | "md" | "lg" | "xl" }) => {
  const s = { xs: "w-6 h-6 text-xs", sm: "w-8 h-8 text-xs", md: "w-9 h-9 text-sm", lg: "w-11 h-11 text-base", xl: "w-16 h-16 text-xl" }[size];
  return (
    <div className={`${s} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: color }}>
      {initials}
    </div>
  );
};

const StatCard = ({ label, value, sub, icon: Icon, trend, color = "purple" }: {
  label: string; value: string | number; sub?: string;
  icon?: React.ElementType; trend?: { value: number; label: string };
  color?: "purple" | "blue" | "green" | "amber" | "red";
}) => {
  const colors = {
    purple: "bg-purple-50 text-purple-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        {Icon && <div className={`p-2 rounded-lg ${colors[color]}`}><Icon size={18} /></div>}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend.value >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          <TrendingUp size={12} className={trend.value < 0 ? "rotate-180" : ""} />
          {Math.abs(trend.value)}% {trend.label}
        </div>
      )}
    </div>
  );
};

const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>{children}</div>
);

const CardHeader = ({ title, action, sub }: { title: string; action?: ReactNode; sub?: string }) => (
  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
    <div>
      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
    {action}
  </div>
);

const Input = ({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <input {...props}
      className={`w-full px-3 py-2 bg-gray-50 border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${error ? "border-red-400" : "border-gray-200"} ${props.className ?? ""}`} />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

const Select = ({ label, children, error, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <select {...props}
      className={`w-full px-3 py-2 bg-gray-50 border rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${error ? "border-red-400" : "border-gray-200"}`}>
      {children}
    </select>
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

const Textarea = ({ label, error, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <textarea {...props} rows={3}
      className={`w-full px-3 py-2 bg-gray-50 border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none ${error ? "border-red-400" : "border-gray-200"}`} />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

const Modal = ({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, sub, action }: {
  icon: React.ElementType; title: string; sub?: string; action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center py-14 text-center">
    <div className="p-4 bg-gray-50 rounded-2xl mb-4"><Icon size={28} className="text-gray-300" /></div>
    <p className="font-semibold text-gray-700">{title}</p>
    {sub && <p className="text-sm text-gray-400 mt-1 max-w-xs">{sub}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const attBadge = (s: AttStatus) => {
  const map: Record<AttStatus, [string, string]> = {
    present: ["success", "Present"],
    absent: ["danger", "Absent"],
    late: ["warning", "Late"],
    "half-day": ["info", "Half Day"],
    weekend: ["gray", "Weekend"],
    holiday: ["purple", "Holiday"],
  };
  const [v, label] = map[s] ?? ["default", s];
  return <Badge variant={v as never}>{label}</Badge>;
};

const leaveBadge = (s: LeaveStatus) => {
  const map: Record<LeaveStatus, string> = { pending: "warning", approved: "success", rejected: "danger" };
  return <Badge variant={map[s] as never}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
};

const salaryBadge = (s: SalaryStatus) => {
  const map: Record<SalaryStatus, string> = { paid: "success", pending: "warning", processing: "info" };
  return <Badge variant={map[s] as never}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
};

const notifIcon = (t: NotifType) => {
  const map = {
    info: <Info size={16} className="text-blue-500" />,
    success: <CheckCircle size={16} className="text-emerald-500" />,
    warning: <AlertCircle size={16} className="text-amber-500" />,
    error: <XCircle size={16} className="text-red-500" />,
  };
  return map[t];
};

// ─── HEADER ──────────────────────────────────────────────────────────────────

function Header() {
  const { currentUser, page, navigate, notifications, signOut } = useApp();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!currentUser) return null;

  const unread = notifications.filter((n) => n.userId === currentUser.id && !n.read).length;
  const isAdmin = currentUser.role === "admin";

  const navItems = [
    { key: "employees", label: "Employees", icon: Users },
    { key: "attendance", label: "Attendance", icon: Clock },
    { key: "time-off", label: "Time Off", icon: Calendar },
    { key: "salary", label: "Salary", icon: DollarSign },
    ...(isAdmin ? [{ key: "salary-config", label: "Pay Config", icon: Layers }] : []),
  ];

  const getPage = (key: string) => {
    if (key === "employees") return isAdmin ? "employees" : "employee-profile";
    if (key === "employees" && !isAdmin) return "employee-profile";
    return key;
  };

  const isActive = (key: string) => page === getPage(key) || page === key;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between h-14 px-4 md:px-6 max-w-screen-xl mx-auto">
        {/* Logo */}
        <button onClick={() => navigate(isAdmin ? "admin-dashboard" : "emp-dashboard")}
          className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="font-bold text-gray-900 text-base hidden sm:block">Dayflow</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => navigate(getPage(key))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(key)
                  ? "bg-purple-50 text-purple-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Right area */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button onClick={() => navigate("notifications")}
            className={`relative p-2 rounded-lg transition-colors ${page === "notifications" ? "bg-purple-50 text-purple-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}>
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {/* Mobile menu */}
          <button className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg" onClick={() => setMobileOpen((o) => !o)}>
            <Menu size={18} />
          </button>

          {/* Avatar dropdown */}
          <div className="relative">
            <button onClick={() => setAvatarOpen((o) => !o)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
              <AvatarCircle initials={currentUser.initials} color={currentUser.avatarColor} size="sm" />
              <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[120px] truncate">{currentUser.name}</span>
              <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
            </button>
            {avatarOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAvatarOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20">
                  <div className="px-3 py-2 border-b border-gray-100 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{currentUser.name}</p>
                    <p className="text-xs text-gray-400 truncate">{currentUser.email}</p>
                  </div>
                  <button onClick={() => { navigate(isAdmin ? "admin-dashboard" : "emp-dashboard"); setAvatarOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <Home size={15} /> Dashboard
                  </button>
                  <button onClick={() => { navigate("employee-profile", { employeeId: currentUser.id }); setAvatarOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <User size={15} /> My Profile
                  </button>
                  <button onClick={() => { navigate("settings"); setAvatarOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <Settings size={15} /> Settings
                  </button>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button onClick={() => { signOut(); setAvatarOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 px-4 py-2 flex flex-wrap gap-1">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { navigate(getPage(key)); setMobileOpen(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                isActive(key) ? "bg-purple-50 text-purple-700" : "text-gray-600 hover:bg-gray-100"
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

// ─── LAYOUT WRAPPER ───────────────────────────────────────────────────────────

function PageLayout({ children, title, sub, action, back }: {
  children: ReactNode; title?: string; sub?: string; action?: ReactNode; back?: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="pt-14">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6">
          {(title || back) && (
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {back && (
                  <button onClick={back} className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div>
                  {title && <h1 className="text-xl font-bold text-gray-900">{title}</h1>}
                  {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
                </div>
              </div>
              {action}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── SIGN IN ─────────────────────────────────────────────────────────────────

function SignInPage() {
  const { signIn, navigate } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setTimeout(() => {
      const err = signIn(email, password);
      if (err) setError(err);
      setLoading(false);
    }, 500);
  };

  const demo = (role: "employee" | "admin") => {
    setEmail(role === "admin" ? "admin@dayflow.com" : "employee@dayflow.com");
    setPassword(role === "admin" ? "admin123" : "employee123");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Dayflow</h1>
          <p className="text-gray-500 mt-1 text-sm">Sign in to your HR workspace</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email address" type="email" value={email} placeholder="you@dayflow.com"
              onChange={(e) => setEmail(e.target.value)} />
            <Input label="Password" type="password" value={password} placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)} />
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                <AlertCircle size={15} /> {error}
              </div>
            )}
            <Btn type="submit" fullWidth disabled={loading}>
              {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign In"}
            </Btn>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3 font-medium uppercase tracking-wide">Quick demo access</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => demo("employee")}
                className="p-3 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors text-left">
                <p className="text-xs font-semibold text-purple-700">Employee</p>
                <p className="text-xs text-gray-400 mt-0.5">Sarah Johnson</p>
              </button>
              <button onClick={() => demo("admin")}
                className="p-3 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors text-left">
                <p className="text-xs font-semibold text-indigo-700">Admin / HR</p>
                <p className="text-xs text-gray-400 mt-0.5">Michael Chen</p>
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-4">
            No account?{" "}
            <button onClick={() => navigate("signup")} className="text-purple-600 font-medium hover:underline">
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SIGN UP ─────────────────────────────────────────────────────────────────

function SignUpPage() {
  const { signUp, navigate } = useApp();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", department: "Engineering", position: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    if (!form.position.trim()) e.position = "Position is required";
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setTimeout(() => {
      const err = signUp({ name: form.name, email: form.email, password: form.password, department: form.department, position: form.position });
      if (err) setApiError(err);
      setLoading(false);
    }, 600);
  };

  const departments = ["Engineering", "Design", "Marketing", "Sales", "Human Resources", "Finance", "Operations", "Customer Success"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-1 text-sm">Join Dayflow as a new team member</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full name" value={form.name} placeholder="Sarah Johnson"
              onChange={set("name")} error={errors.name} />
            <Input label="Email address" type="email" value={form.email} placeholder="you@company.com"
              onChange={set("email")} error={errors.email} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Department" value={form.department} onChange={set("department")}>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </Select>
              <Input label="Position / Title" value={form.position} placeholder="Software Engineer"
                onChange={set("position")} error={errors.position} />
            </div>
            <Input label="Password" type="password" value={form.password} placeholder="Min. 6 characters"
              onChange={set("password")} error={errors.password} />
            <Input label="Confirm password" type="password" value={form.confirm} placeholder="Repeat password"
              onChange={set("confirm")} error={errors.confirm} />
            {apiError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                <AlertCircle size={15} /> {apiError}
              </div>
            )}
            <Btn type="submit" fullWidth disabled={loading}>
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {loading ? "Creating account…" : "Create Account"}
            </Btn>
          </form>
          <p className="text-center text-sm text-gray-400 mt-4">
            Already have an account?{" "}
            <button onClick={() => navigate("signin")} className="text-purple-600 font-medium hover:underline">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── EMPLOYEE DASHBOARD ───────────────────────────────────────────────────────

function EmployeeDashboard() {
  const { currentUser, attendance, leaves, salaryRecords, navigate, checkIn, checkOut, notifications } = useApp();
  if (!currentUser) return null;

  const todayAtt = attendance.find((a) => a.employeeId === currentUser.id && a.date === today);
  const myMonthAtt = attendance.filter((a) => a.employeeId === currentUser.id && a.date.startsWith(monthStr(0)));
  const presentDays = myMonthAtt.filter((a) => ["present", "late", "half-day"].includes(a.status)).length;
  const absentDays = myMonthAtt.filter((a) => a.status === "absent").length;
  const lateDays = myMonthAtt.filter((a) => a.status === "late").length;

  const myLeaves = leaves.filter((l) => l.employeeId === currentUser.id);
  const approvedAnnual = myLeaves.filter((l) => l.type === "annual" && l.status === "approved").reduce((sum, l) => sum + l.days, 0);
  const annualBalance = 20 - approvedAnnual;

  const latestSalary = salaryRecords.filter((s) => s.employeeId === currentUser.id).sort((a, b) => b.month.localeCompare(a.month))[0];

  const recentAtt = attendance.filter((a) => a.employeeId === currentUser.id && !["weekend", "holiday"].includes(a.status))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const pendingLeaves = myLeaves.filter((l) => l.status === "pending");
  const unreadNotifs = notifications.filter((n) => n.userId === currentUser.id && !n.read).slice(0, 3);

  const now = new Date();
  const greet = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <PageLayout title={`${greet}, ${currentUser.name.split(" ")[0]} 👋`}
      sub={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Check-in card */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Today's Attendance</h3>
                <p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
              </div>
              {todayAtt ? attBadge(todayAtt.status) : <Badge variant="gray">Not Started</Badge>}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: "Check In", value: todayAtt?.checkIn ?? "—", icon: "→" },
                { label: "Check Out", value: todayAtt?.checkOut ?? "—", icon: "←" },
                { label: "Hours Worked", value: todayAtt?.hours ? `${todayAtt.hours}h` : "—", icon: "⏱" },
              ].map(({ label, value }) => (
                <div key={label} className="text-center bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="font-semibold text-gray-900 font-mono">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Btn variant={todayAtt?.checkIn ? "outline" : "primary"} disabled={!!todayAtt?.checkIn}
                onClick={() => checkIn(currentUser.id)} className="flex-1">
                <UserCheck size={15} /> {todayAtt?.checkIn ? `Checked in at ${todayAtt.checkIn}` : "Check In"}
              </Btn>
              <Btn variant={todayAtt?.checkOut ? "outline" : "secondary"}
                disabled={!todayAtt?.checkIn || !!todayAtt?.checkOut}
                onClick={() => checkOut(currentUser.id)} className="flex-1">
                <LogOut size={15} /> {todayAtt?.checkOut ? `Checked out at ${todayAtt.checkOut}` : "Check Out"}
              </Btn>
            </div>
          </Card>

          {/* Monthly stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Days Present" value={presentDays} sub="This month" icon={UserCheck} color="green" />
            <StatCard label="Days Absent" value={absentDays} sub="This month" icon={XCircle} color="red" />
            <StatCard label="Late Arrivals" value={lateDays} sub="This month" icon={Clock} color="amber" />
            <StatCard label="Leave Balance" value={`${annualBalance} days`} sub="Annual remaining" icon={Calendar} color="purple" />
          </div>

          {/* Recent attendance */}
          <Card>
            <CardHeader title="Recent Attendance" action={
              <Btn variant="ghost" size="sm" onClick={() => navigate("attendance")}>View all <ChevronRight size={13} /></Btn>
            } />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {["Date", "Check In", "Check Out", "Hours", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {recentAtt.map((rec) => (
                    <tr key={rec.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700">{formatDateShort(rec.date)}</td>
                      <td className="px-4 py-3 font-mono text-gray-600">{rec.checkIn ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-gray-600">{rec.checkOut ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{rec.hours ? `${rec.hours}h` : "—"}</td>
                      <td className="px-4 py-3">{attBadge(rec.status)}</td>
                    </tr>
                  ))}
                  {recentAtt.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No attendance records yet</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Salary card */}
          {latestSalary && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Latest Salary</h3>
                {salaryBadge(latestSalary.status)}
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-1">{formatCurrency(latestSalary.netSalary)}</p>
              <p className="text-xs text-gray-400 mb-4">{formatMonthLabel(latestSalary.month)}</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Basic", value: latestSalary.basicSalary },
                  { label: "Allowances", value: latestSalary.allowances },
                  { label: "Bonus", value: latestSalary.bonus },
                  { label: "Tax", value: -latestSalary.tax },
                  { label: "Deductions", value: -latestSalary.deductions },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-gray-500">{label}</span>
                    <span className={`font-medium font-mono ${value < 0 ? "text-red-500" : "text-gray-700"}`}>
                      {value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <Btn variant="ghost" size="sm" fullWidth onClick={() => navigate("salary")}>
                  <FileText size={13} /> View All Payslips
                </Btn>
              </div>
            </Card>
          )}

          {/* Pending leaves */}
          <Card>
            <CardHeader title="Leave Requests" action={
              <Btn variant="ghost" size="sm" onClick={() => navigate("time-off")}>View all</Btn>
            } />
            <div className="p-4 flex flex-col gap-2">
              {pendingLeaves.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No pending requests</p>
              ) : (
                pendingLeaves.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800 capitalize">{l.type} leave</p>
                      <p className="text-xs text-gray-400">{formatDateShort(l.startDate)} · {l.days} day{l.days > 1 ? "s" : ""}</p>
                    </div>
                    {leaveBadge(l.status)}
                  </div>
                ))
              )}
              <Btn variant="secondary" size="sm" fullWidth onClick={() => navigate("time-off")}>
                <Plus size={13} /> Request Leave
              </Btn>
            </div>
          </Card>

          {/* Notifications preview */}
          {unreadNotifs.length > 0 && (
            <Card>
              <CardHeader title="Notifications" action={
                <Btn variant="ghost" size="sm" onClick={() => navigate("notifications")}>See all</Btn>
              } />
              <div className="p-2 flex flex-col gap-1">
                {unreadNotifs.map((n) => (
                  <div key={n.id} className="flex gap-2 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate("notifications")}>
                    <div className="mt-0.5">{notifIcon(n.type)}</div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const { currentUser, employees, attendance, leaves, salaryRecords, navigate, reviewLeave } = useApp();
  if (!currentUser) return null;

  const activeEmps = employees.filter((e) => e.status === "active");
  const todayAtts = attendance.filter((a) => a.date === today);
  const presentToday = todayAtts.filter((a) => ["present", "late"].includes(a.status)).length;
  const absentToday = activeEmps.filter((e) => !todayAtts.find((a) => a.employeeId === e.id && ["present", "late", "half-day"].includes(a.status))).length;
  const pendingLeaves = leaves.filter((l) => l.status === "pending");
  const currentMonthSalary = salaryRecords.filter((s) => s.month === monthStr(0));
  const totalPayroll = currentMonthSalary.reduce((sum, s) => sum + s.netSalary, 0);

  const deptCounts = employees.reduce<Record<string, number>>((acc, e) => {
    if (e.status === "active") acc[e.department] = (acc[e.department] ?? 0) + 1;
    return acc;
  }, {});

  const recentActivity = attendance
    .filter((a) => ["present", "late"].includes(a.status) && a.checkIn)
    .sort((a, b) => `${b.date}${b.checkIn}`.localeCompare(`${a.date}${a.checkIn}`))
    .slice(0, 6);

  const [reviewModal, setReviewModal] = useState<{ leave: LeaveRequest | null }>({ leave: null });
  const [reviewComment, setReviewComment] = useState("");

  const handleReview = (status: LeaveStatus) => {
    if (!reviewModal.leave) return;
    reviewLeave(reviewModal.leave.id, status, reviewComment, currentUser.id);
    setReviewModal({ leave: null });
    setReviewComment("");
  };

  return (
    <PageLayout title="Admin Dashboard"
      sub={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Employees" value={activeEmps.length} sub={`${employees.filter(e=>e.status==="inactive").length} inactive`} icon={Users} color="purple" />
        <StatCard label="Present Today" value={presentToday} sub={`of ${activeEmps.length} active`} icon={UserCheck} color="green" />
        <StatCard label="Absent Today" value={absentToday} sub="Not checked in" icon={XCircle} color="red" />
        <StatCard label="Pending Leaves" value={pendingLeaves.length} sub="Awaiting review" icon={Calendar} color="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-5">
          {/* Pending Leave Approvals */}
          <Card>
            <CardHeader title="Pending Leave Requests" sub={`${pendingLeaves.length} awaiting review`} action={
              <Btn variant="ghost" size="sm" onClick={() => navigate("time-off")}>View all <ChevronRight size={13} /></Btn>
            } />
            <div className="divide-y divide-gray-50">
              {pendingLeaves.slice(0, 5).map((l) => {
                const emp = employees.find((e) => e.id === l.employeeId);
                return (
                  <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                    {emp && <AvatarCircle initials={emp.initials} color={emp.avatarColor} size="sm" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{emp?.name ?? "Unknown"}</p>
                      <p className="text-xs text-gray-400 capitalize">{l.type} leave · {l.days} day{l.days > 1 ? "s" : ""} · {formatDateShort(l.startDate)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Btn variant="success" size="xs" onClick={() => { reviewLeave(l.id, "approved", "", currentUser.id); }}>
                        <Check size={12} /> Approve
                      </Btn>
                      <Btn variant="outline" size="xs" onClick={() => { setReviewModal({ leave: l }); setReviewComment(""); }}>
                        <Eye size={12} /> Review
                      </Btn>
                    </div>
                  </div>
                );
              })}
              {pendingLeaves.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  <CheckCircle size={28} className="mx-auto mb-2 text-emerald-300" />
                  All leave requests are reviewed
                </div>
              )}
            </div>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader title="Today's Check-ins" sub="Recent attendance activity" />
            <div className="divide-y divide-gray-50">
              {recentActivity.slice(0, 5).map((rec) => {
                const emp = employees.find((e) => e.id === rec.employeeId);
                return (
                  <div key={rec.id} className="flex items-center gap-3 px-5 py-3">
                    {emp && <AvatarCircle initials={emp.initials} color={emp.avatarColor} size="sm" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{emp?.name ?? "Unknown"}</p>
                      <p className="text-xs text-gray-400">{emp?.department} · {emp?.position}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-gray-700">{rec.checkIn}</p>
                      {attBadge(rec.status)}
                    </div>
                  </div>
                );
              })}
              {recentActivity.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-gray-400">No check-ins today yet</div>
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          {/* Payroll summary */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Payroll Overview</h3>
              <Badge variant="warning">Pending</Badge>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalPayroll)}</p>
            <p className="text-xs text-gray-400 mb-4">{formatMonthLabel(monthStr(0))}</p>
            <div className="space-y-2 mb-4">
              {[
                { label: "Paid", count: currentMonthSalary.filter(s=>s.status==="paid").length, color: "text-emerald-600" },
                { label: "Pending", count: currentMonthSalary.filter(s=>s.status==="pending").length, color: "text-amber-600" },
                { label: "Processing", count: currentMonthSalary.filter(s=>s.status==="processing").length, color: "text-blue-600" },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className={`font-semibold ${color}`}>{count} employees</span>
                </div>
              ))}
            </div>
            <Btn variant="primary" size="sm" fullWidth onClick={() => navigate("salary")}>
              <DollarSign size={13} /> Manage Payroll
            </Btn>
          </Card>

          {/* Department overview */}
          <Card>
            <CardHeader title="Departments" />
            <div className="p-4 flex flex-col gap-2">
              {Object.entries(deptCounts).sort((a,b) => b[1]-a[1]).map(([dept, count]) => (
                <div key={dept} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">{dept}</span>
                      <span className="text-gray-400">{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${(count / activeEmps.length) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick actions */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Add Employee", icon: UserPlus, action: () => navigate("employees") },
                { label: "All Attendance", icon: Clock, action: () => navigate("attendance") },
                { label: "Pay Config", icon: CreditCard, action: () => navigate("salary-config") },
                { label: "Settings", icon: Settings, action: () => navigate("settings") },
              ].map(({ label, icon: Icon, action }) => (
                <button key={label} onClick={action}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-purple-200 transition-all text-center group">
                  <Icon size={18} className="text-gray-400 group-hover:text-purple-600 transition-colors" />
                  <span className="text-xs text-gray-600 font-medium">{label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Review modal */}
      <Modal open={!!reviewModal.leave} onClose={() => setReviewModal({ leave: null })} title="Review Leave Request">
        {reviewModal.leave && (() => {
          const l = reviewModal.leave!;
          const emp = employees.find((e) => e.id === l.employeeId);
          return (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                {emp && <AvatarCircle initials={emp.initials} color={emp.avatarColor} />}
                <div>
                  <p className="font-semibold text-gray-900">{emp?.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{l.type} leave · {l.days} day{l.days > 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">From</p><p className="font-medium">{formatDateShort(l.startDate)}</p></div>
                <div><p className="text-xs text-gray-400">To</p><p className="font-medium">{formatDateShort(l.endDate)}</p></div>
              </div>
              <div><p className="text-xs text-gray-400 mb-1">Reason</p><p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{l.reason}</p></div>
              <Textarea label="Comment (optional)" value={reviewComment} placeholder="Add a note for the employee…"
                onChange={(e) => setReviewComment(e.target.value)} />
              <div className="flex gap-3 pt-2">
                <Btn variant="danger" fullWidth onClick={() => handleReview("rejected")}><XCircle size={14} /> Reject</Btn>
                <Btn variant="success" fullWidth onClick={() => handleReview("approved")}><CheckCircle size={14} /> Approve</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>
    </PageLayout>
  );
}

// ─── EMPLOYEES PAGE ───────────────────────────────────────────────────────────

function EmployeesPage() {
  const { employees, navigate, addEmployee, updateEmployee } = useApp();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "employee123", department: "Engineering", position: "", phone: "", joinDate: today, role: "employee" as Role });
  const [formError, setFormError] = useState("");

  const departments = ["All", ...Array.from(new Set(employees.map((e) => e.department)))];

  const filtered = employees.filter((e) => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()) || e.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "All" || e.department === deptFilter;
    const matchStatus = statusFilter === "All" || e.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const handleAdd = () => {
    if (!form.name || !form.email || !form.position) { setFormError("Name, email and position are required."); return; }
    if (employees.find((e) => e.email === form.email)) { setFormError("Email already exists."); return; }
    const newId = `emp-${String(Date.now()).slice(-6)}`;
    const initials = form.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const colors = ["#7C3AED","#0891B2","#059669","#D97706","#DB2777","#4338CA","#0D9488","#DC2626"];
    const emp: Employee = {
      id: newId, email: form.email, password: form.password,
      role: form.role, name: form.name, initials,
      department: form.department, position: form.position,
      phone: form.phone, address: "", joinDate: form.joinDate,
      employeeId: `DF-${String(employees.length + 1).padStart(4, "0")}`,
      manager: "Michael Chen", status: "active",
      avatarColor: colors[employees.length % colors.length],
    };
    addEmployee(emp);
    setAddModal(false);
    setForm({ name: "", email: "", password: "employee123", department: "Engineering", position: "", phone: "", joinDate: today, role: "employee" });
    setFormError("");
  };

  const toggleStatus = (emp: Employee) => {
    updateEmployee({ ...emp, status: emp.status === "active" ? "inactive" : "active" });
  };

  return (
    <PageLayout title="Employees" sub={`${employees.filter(e=>e.status==="active").length} active · ${employees.filter(e=>e.status==="inactive").length} inactive`}
      action={<Btn onClick={() => setAddModal(true)}><Plus size={14} /> Add Employee</Btn>}>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, ID…"
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
          {["All", "active", "inactive"].map((s) => <option key={s} value={s}>{s === "All" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Employee grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((emp) => (
          <Card key={emp.id} className="p-5 hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group">
            <div className="flex items-start gap-3 mb-4">
              <AvatarCircle initials={emp.initials} color={emp.avatarColor} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 truncate">{emp.name}</p>
                  <Badge variant={emp.status === "active" ? "success" : "gray"}>{emp.status}</Badge>
                </div>
                <p className="text-sm text-gray-500 truncate">{emp.position}</p>
                <p className="text-xs text-gray-400 mt-0.5">{emp.department} · {emp.employeeId}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-gray-500 mb-4">
              <div className="flex items-center gap-1.5"><Mail size={11} /> {emp.email}</div>
              {emp.phone && <div className="flex items-center gap-1.5"><Phone size={11} /> {emp.phone}</div>}
              <div className="flex items-center gap-1.5"><Briefcase size={11} /> Joined {formatDateShort(emp.joinDate)}</div>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" size="sm" className="flex-1"
                onClick={() => navigate("employee-profile", { employeeId: emp.id })}>
                <Eye size={13} /> View Profile
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => toggleStatus(emp)}>
                {emp.status === "active" ? <XCircle size={13} /> : <CheckCircle size={13} />}
              </Btn>
            </div>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && (
        <EmptyState icon={Users} title="No employees found" sub="Try adjusting your search or filters" />
      )}

      {/* Add Employee Modal */}
      <Modal open={addModal} onClose={() => { setAddModal(false); setFormError(""); }} title="Add New Employee" wide>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Input label="Full Name" value={form.name} onChange={(e) => setForm(f=>({...f, name: e.target.value}))} placeholder="John Smith" /></div>
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm(f=>({...f, email: e.target.value}))} placeholder="john@company.com" />
          <Input label="Password" type="text" value={form.password} onChange={(e) => setForm(f=>({...f, password: e.target.value}))} />
          <Select label="Department" value={form.department} onChange={(e) => setForm(f=>({...f, department: e.target.value}))}>
            {["Engineering","Design","Marketing","Sales","Human Resources","Finance","Operations"].map(d=><option key={d}>{d}</option>)}
          </Select>
          <Input label="Position" value={form.position} onChange={(e) => setForm(f=>({...f, position: e.target.value}))} placeholder="Software Engineer" />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm(f=>({...f, phone: e.target.value}))} placeholder="+1 (555) 000-0000" />
          <Input label="Join Date" type="date" value={form.joinDate} onChange={(e) => setForm(f=>({...f, joinDate: e.target.value}))} />
          <div className="col-span-2">
            <Select label="Role" value={form.role} onChange={(e) => setForm(f=>({...f, role: e.target.value as Role}))}>
              <option value="employee">Employee</option>
              <option value="admin">Admin / HR</option>
            </Select>
          </div>
        </div>
        {formError && <p className="text-sm text-red-500 mt-3">{formError}</p>}
        <div className="flex gap-3 mt-5">
          <Btn variant="outline" fullWidth onClick={() => setAddModal(false)}>Cancel</Btn>
          <Btn fullWidth onClick={handleAdd}><UserPlus size={14} /> Add Employee</Btn>
        </div>
      </Modal>
    </PageLayout>
  );
}

// ─── EMPLOYEE PROFILE ─────────────────────────────────────────────────────────

function EmployeeProfilePage() {
  const { currentUser, employees, attendance, leaves, salaryRecords, navParams, navigate, updateEmployee } = useApp();
  const isAdmin = currentUser?.role === "admin";
  const empId = navParams.employeeId ?? currentUser?.id ?? "";
  const emp = employees.find((e) => e.id === empId);

  const [activeTab, setActiveTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Employee | null>(null);

  useEffect(() => { if (emp) setForm({ ...emp }); }, [emp]);

  if (!emp || !form) return (
    <PageLayout back={() => navigate(isAdmin ? "employees" : "emp-dashboard")}>
      <EmptyState icon={User} title="Employee not found" />
    </PageLayout>
  );

  const myAtt = attendance.filter((a) => a.employeeId === emp.id && !["weekend", "holiday"].includes(a.status))
    .sort((a, b) => b.date.localeCompare(a.date));
  const myLeaves = leaves.filter((l) => l.employeeId === emp.id).sort((a, b) => b.appliedOn.localeCompare(a.appliedOn));
  const mySalary = salaryRecords.filter((s) => s.employeeId === emp.id).sort((a, b) => b.month.localeCompare(a.month));

  const handleSave = () => {
    updateEmployee(form);
    setEditing(false);
  };

  const tabs = ["overview", "attendance", "leave", "salary"];

  return (
    <PageLayout back={() => navigate(isAdmin ? "employees" : "emp-dashboard")}>
      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start gap-5">
          <AvatarCircle initials={emp.initials} color={emp.avatarColor} size="xl" />
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">{emp.name}</h2>
              <Badge variant={emp.status === "active" ? "success" : "gray"}>{emp.status}</Badge>
              <Badge variant="purple">{emp.role === "admin" ? "Admin / HR" : "Employee"}</Badge>
            </div>
            <p className="text-gray-600 mt-0.5">{emp.position} · {emp.department}</p>
            <p className="text-sm text-gray-400">{emp.employeeId}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Mail size={13} /> {emp.email}</span>
              {emp.phone && <span className="flex items-center gap-1"><Phone size={13} /> {emp.phone}</span>}
              {emp.address && <span className="flex items-center gap-1"><MapPin size={13} /> {emp.address}</span>}
              <span className="flex items-center gap-1"><Briefcase size={13} /> Joined {formatDateShort(emp.joinDate)}</span>
              {emp.manager !== "—" && <span className="flex items-center gap-1"><User size={13} /> Reports to {emp.manager}</span>}
            </div>
          </div>
          {(isAdmin || currentUser?.id === emp.id) && (
            <Btn variant="outline" size="sm" onClick={() => setEditing(true)}><Edit size={13} /> Edit</Btn>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1 w-fit">
        {tabs.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeTab === t ? "bg-purple-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>{t}</button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Days Present (Month)" value={myAtt.filter(a=>a.date.startsWith(monthStr(0))&&["present","late","half-day"].includes(a.status)).length} icon={UserCheck} color="green" />
          <StatCard label="Days Absent (Month)" value={myAtt.filter(a=>a.date.startsWith(monthStr(0))&&a.status==="absent").length} icon={XCircle} color="red" />
          <StatCard label="Annual Leave Taken" value={myLeaves.filter(l=>l.type==="annual"&&l.status==="approved").reduce((s,l)=>s+l.days,0)} sub="days this year" icon={Calendar} color="blue" />
          <StatCard label="Net Salary" value={mySalary[0] ? formatCurrency(mySalary[0].netSalary) : "—"} sub={mySalary[0] ? formatMonthLabel(mySalary[0].month) : ""} icon={DollarSign} color="purple" />
        </div>
      )}

      {/* Attendance tab */}
      {activeTab === "attendance" && (
        <Card>
          <CardHeader title="Attendance History" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["Date","Check In","Check Out","Hours","Status"].map(h=>(
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {myAtt.slice(0, 30).map((rec) => (
                  <tr key={rec.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{formatDateShort(rec.date)}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{rec.checkIn ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{rec.checkOut ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{rec.hours ? `${rec.hours}h` : "—"}</td>
                    <td className="px-4 py-3">{attBadge(rec.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myAtt.length === 0 && <EmptyState icon={Clock} title="No attendance records" />}
          </div>
        </Card>
      )}

      {/* Leave tab */}
      {activeTab === "leave" && (
        <Card>
          <CardHeader title="Leave History" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["Type","From","To","Days","Reason","Status"].map(h=>(
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {myLeaves.map((l) => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 capitalize"><Badge variant="default">{l.type}</Badge></td>
                    <td className="px-4 py-3 text-gray-700">{formatDateShort(l.startDate)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDateShort(l.endDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{l.days}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{l.reason}</td>
                    <td className="px-4 py-3">{leaveBadge(l.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myLeaves.length === 0 && <EmptyState icon={Calendar} title="No leave history" />}
          </div>
        </Card>
      )}

      {/* Salary tab */}
      {activeTab === "salary" && (
        <Card>
          <CardHeader title="Salary History" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["Month","Basic","Allowances","Bonus","Tax","Deductions","Net","Status"].map(h=>(
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {mySalary.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 font-medium">{formatMonthLabel(s.month)}</td>
                    <td className="px-4 py-3 font-mono text-gray-600 text-xs">{formatCurrency(s.basicSalary)}</td>
                    <td className="px-4 py-3 font-mono text-gray-600 text-xs">{formatCurrency(s.allowances)}</td>
                    <td className="px-4 py-3 font-mono text-emerald-600 text-xs">{formatCurrency(s.bonus)}</td>
                    <td className="px-4 py-3 font-mono text-red-500 text-xs">-{formatCurrency(s.tax)}</td>
                    <td className="px-4 py-3 font-mono text-red-500 text-xs">-{formatCurrency(s.deductions)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-900">{formatCurrency(s.netSalary)}</td>
                    <td className="px-4 py-3">{salaryBadge(s.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mySalary.length === 0 && <EmptyState icon={DollarSign} title="No salary records" />}
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Employee" wide>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Input label="Full Name" value={form.name}
            onChange={(e) => setForm(f=>f ? {...f, name: e.target.value} : f)} /></div>
          <Input label="Email" value={form.email} onChange={(e) => setForm(f=>f ? {...f, email: e.target.value} : f)} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm(f=>f ? {...f, phone: e.target.value} : f)} />
          <Input label="Position" value={form.position} onChange={(e) => setForm(f=>f ? {...f, position: e.target.value} : f)} />
          <Select label="Department" value={form.department} onChange={(e) => setForm(f=>f ? {...f, department: e.target.value} : f)}>
            {["Engineering","Design","Marketing","Sales","Human Resources","Finance","Operations"].map(d=><option key={d}>{d}</option>)}
          </Select>
          <div className="col-span-2"><Input label="Address" value={form.address}
            onChange={(e) => setForm(f=>f ? {...f, address: e.target.value} : f)} /></div>
          {isAdmin && (
            <Select label="Status" value={form.status} onChange={(e) => setForm(f=>f ? {...f, status: e.target.value as EmpStatus} : f)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <Btn variant="outline" fullWidth onClick={() => setEditing(false)}>Cancel</Btn>
          <Btn fullWidth onClick={handleSave}><Save size={13} /> Save Changes</Btn>
        </div>
      </Modal>
    </PageLayout>
  );
}

// ─── ATTENDANCE PAGE ──────────────────────────────────────────────────────────

function AttendancePage() {
  const { currentUser, employees, attendance, checkIn, checkOut } = useApp();
  if (!currentUser) return null;
  const isAdmin = currentUser.role === "admin";

  const [dateFilter, setDateFilter] = useState(today);
  const [empFilter, setEmpFilter] = useState("All");
  const [search, setSearch] = useState("");

  const todayAtt = attendance.find((a) => a.employeeId === currentUser.id && a.date === today);

  const filtered = isAdmin
    ? attendance.filter((a) => {
        const matchDate = !dateFilter || a.date === dateFilter;
        const matchEmp = empFilter === "All" || a.employeeId === empFilter;
        const emp = employees.find((e) => e.id === a.employeeId);
        const matchSearch = !search || emp?.name.toLowerCase().includes(search.toLowerCase());
        return matchDate && matchEmp && matchSearch && !["weekend", "holiday"].includes(a.status);
      }).sort((a, b) => b.date.localeCompare(a.date))
    : attendance.filter((a) => a.employeeId === currentUser.id && !["weekend", "holiday"].includes(a.status))
        .sort((a, b) => b.date.localeCompare(a.date));

  const monthAtt = attendance.filter(a => a.employeeId === currentUser.id && a.date.startsWith(monthStr(0)));
  const presentCount = monthAtt.filter(a => ["present","late","half-day"].includes(a.status)).length;
  const absentCount = monthAtt.filter(a => a.status === "absent").length;
  const lateCount = monthAtt.filter(a => a.status === "late").length;
  const totalHours = monthAtt.reduce((s,a) => s + a.hours, 0);

  return (
    <PageLayout title="Attendance" sub={isAdmin ? "Team attendance records" : "Your attendance history"}>
      {/* Check-in card for employee */}
      {!isAdmin && (
        <Card className="p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Today — {formatDateShort(today)}</h3>
            {todayAtt ? attBadge(todayAtt.status) : <Badge variant="gray">Not started</Badge>}
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Check In", value: todayAtt?.checkIn ?? "—" },
              { label: "Check Out", value: todayAtt?.checkOut ?? "—" },
              { label: "Hours", value: todayAtt?.hours ? `${todayAtt.hours}h` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-semibold font-mono text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Btn disabled={!!todayAtt?.checkIn} onClick={() => checkIn(currentUser.id)} className="flex-1">
              <UserCheck size={14} /> {todayAtt?.checkIn ? `Checked in at ${todayAtt.checkIn}` : "Check In Now"}
            </Btn>
            <Btn variant="secondary" disabled={!todayAtt?.checkIn || !!todayAtt?.checkOut}
              onClick={() => checkOut(currentUser.id)} className="flex-1">
              <LogOut size={14} /> {todayAtt?.checkOut ? `Checked out at ${todayAtt.checkOut}` : "Check Out"}
            </Btn>
          </div>
        </Card>
      )}

      {/* Monthly summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard label="Present" value={presentCount} sub="This month" icon={UserCheck} color="green" />
        <StatCard label="Absent" value={absentCount} sub="This month" icon={XCircle} color="red" />
        <StatCard label="Late" value={lateCount} sub="This month" icon={Clock} color="amber" />
        <StatCard label="Total Hours" value={`${Math.round(totalHours)}h`} sub="This month" icon={BarChart2} color="purple" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        {isAdmin && (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…"
                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-48" />
            </div>
            <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="All">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </>
        )}
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        <Btn variant="outline" size="md" onClick={() => { setDateFilter(""); setEmpFilter("All"); setSearch(""); }}>
          <RefreshCw size={13} /> Reset
        </Btn>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {[...(isAdmin ? ["Employee"] : []), "Date","Check In","Check Out","Hours","Status","Notes"].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.slice(0, 50).map((rec) => {
                const emp = employees.find((e) => e.id === rec.employeeId);
                return (
                  <tr key={rec.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {emp && <AvatarCircle initials={emp.initials} color={emp.avatarColor} size="xs" />}
                          <span className="font-medium text-gray-800">{emp?.name ?? "—"}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-700">{formatDateShort(rec.date)}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{rec.checkIn ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{rec.checkOut ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{rec.hours ? `${rec.hours}h` : "—"}</td>
                    <td className="px-4 py-3">{attBadge(rec.status)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{rec.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Clock} title="No records found" sub="Try adjusting filters" />}
        </div>
        {filtered.length > 50 && (
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-400 text-center">
            Showing 50 of {filtered.length} records
          </div>
        )}
      </Card>
    </PageLayout>
  );
}

// ─── TIME OFF PAGE ────────────────────────────────────────────────────────────

function TimeOffPage() {
  const { currentUser, employees, leaves, submitLeave, reviewLeave, cancelLeave } = useApp();
  if (!currentUser) return null;
  const isAdmin = currentUser.role === "admin";

  const [tab, setTab] = useState<"pending" | "history" | "request">(isAdmin ? "pending" : "request");
  const [reviewModal, setReviewModal] = useState<{ leave: LeaveRequest | null }>({ leave: null });
  const [reviewComment, setReviewComment] = useState("");
  const [form, setForm] = useState({ type: "annual" as LeaveType, startDate: "", endDate: "", reason: "" });
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  const myLeaves = leaves.filter(l => l.employeeId === currentUser.id).sort((a,b) => b.appliedOn.localeCompare(a.appliedOn));
  const pendingLeaves = leaves.filter(l => l.status === "pending").sort((a,b) => b.appliedOn.localeCompare(a.appliedOn));
  const allLeaves = leaves.sort((a,b) => b.appliedOn.localeCompare(a.appliedOn));

  const calcDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const s = new Date(start + "T12:00:00");
    const e = new Date(end + "T12:00:00");
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  };

  const leaveBalance = {
    annual: 20 - myLeaves.filter(l=>l.type==="annual"&&l.status==="approved").reduce((s,l)=>s+l.days,0),
    sick: 10 - myLeaves.filter(l=>l.type==="sick"&&l.status==="approved").reduce((s,l)=>s+l.days,0),
    personal: 5 - myLeaves.filter(l=>l.type==="personal"&&l.status==="approved").reduce((s,l)=>s+l.days,0),
  };

  const handleSubmit = () => {
    if (!form.startDate || !form.endDate) { setFormError("Please select start and end dates."); return; }
    if (!form.reason.trim()) { setFormError("Please provide a reason."); return; }
    if (form.endDate < form.startDate) { setFormError("End date cannot be before start date."); return; }
    submitLeave({
      employeeId: currentUser.id,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      days: calcDays(form.startDate, form.endDate),
      reason: form.reason,
    });
    setForm({ type: "annual", startDate: "", endDate: "", reason: "" });
    setFormError("");
    setSuccess(true);
    setTab("history");
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleReview = (status: LeaveStatus) => {
    if (!reviewModal.leave) return;
    reviewLeave(reviewModal.leave.id, status, reviewComment, currentUser.id);
    setReviewModal({ leave: null });
    setReviewComment("");
  };

  const leaveTypes: LeaveType[] = ["annual", "sick", "personal", "maternity", "paternity", "unpaid"];

  return (
    <PageLayout title="Time Off" sub={isAdmin ? "Manage leave requests" : "Request and track your leave"}>
      {/* Leave balance (employee) */}
      {!isAdmin && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: "Annual Leave", balance: leaveBalance.annual, total: 20, color: "purple" },
            { label: "Sick Leave", balance: leaveBalance.sick, total: 10, color: "blue" },
            { label: "Personal Leave", balance: leaveBalance.personal, total: 5, color: "green" },
          ].map(({ label, balance, total, color }) => (
            <StatCard key={label} label={label} value={`${balance} days`}
              sub={`of ${total} remaining`} icon={Calendar}
              color={color as "purple" | "blue" | "green"} />
          ))}
        </div>
      )}

      {/* Admin stats */}
      {isAdmin && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          <StatCard label="Pending" value={pendingLeaves.length} sub="Awaiting review" icon={Clock} color="amber" />
          <StatCard label="Approved" value={leaves.filter(l=>l.status==="approved").length} sub="Total" icon={CheckCircle} color="green" />
          <StatCard label="Rejected" value={leaves.filter(l=>l.status==="rejected").length} sub="Total" icon={XCircle} color="red" />
          <StatCard label="Total Requests" value={leaves.length} sub="All time" icon={Calendar} color="purple" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1 w-fit">
        {isAdmin
          ? (["pending", "history"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab===t ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                {t} {t === "pending" && pendingLeaves.length > 0 && <span className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5 rounded-full">{pendingLeaves.length}</span>}
              </button>
            ))
          : (["request", "history"] as const).map(t => (
              <button key={t} onClick={() => setTab(t as never)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab===t ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                {t === "request" ? "New Request" : "My Requests"}
              </button>
            ))
        }
      </div>

      {success && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4 text-emerald-700">
          <CheckCircle size={16} /> Leave request submitted successfully!
        </div>
      )}

      {/* Request form */}
      {tab === "request" && !isAdmin && (
        <Card className="max-w-xl">
          <CardHeader title="Submit Leave Request" />
          <div className="p-5 flex flex-col gap-4">
            <Select label="Leave Type" value={form.type} onChange={(e) => setForm(f=>({...f, type: e.target.value as LeaveType}))}>
              {leaveTypes.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase()+t.slice(1)} Leave</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start Date" type="date" value={form.startDate}
                onChange={(e) => setForm(f=>({...f, startDate: e.target.value}))} />
              <Input label="End Date" type="date" value={form.endDate}
                onChange={(e) => setForm(f=>({...f, endDate: e.target.value}))} />
            </div>
            {form.startDate && form.endDate && form.endDate >= form.startDate && (
              <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-700 flex items-center gap-2">
                <Calendar size={14} /> Duration: <strong>{calcDays(form.startDate, form.endDate)} day{calcDays(form.startDate, form.endDate)>1?"s":""}</strong>
              </div>
            )}
            <Textarea label="Reason" value={form.reason} placeholder="Briefly describe the reason for your leave…"
              onChange={(e) => setForm(f=>({...f, reason: e.target.value}))} />
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <Btn onClick={handleSubmit} fullWidth><Plus size={14} /> Submit Request</Btn>
          </div>
        </Card>
      )}

      {/* Pending leaves (admin) */}
      {tab === "pending" && isAdmin && (
        <Card>
          <div className="divide-y divide-gray-50">
            {pendingLeaves.map(l => {
              const emp = employees.find(e=>e.id===l.employeeId);
              return (
                <div key={l.id} className="flex items-center gap-4 px-5 py-4">
                  {emp && <AvatarCircle initials={emp.initials} color={emp.avatarColor} />}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{emp?.name}</p>
                    <p className="text-sm text-gray-500 capitalize">{l.type} leave · {l.days} day{l.days>1?"s":""}</p>
                    <p className="text-xs text-gray-400">{formatDateShort(l.startDate)} → {formatDateShort(l.endDate)}</p>
                  </div>
                  <div className="text-sm text-gray-500 max-w-[200px] hidden md:block">
                    <p className="text-xs text-gray-400 mb-0.5">Reason</p>
                    <p className="line-clamp-2">{l.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <Btn variant="success" size="sm" onClick={() => reviewLeave(l.id, "approved", "", currentUser.id)}>
                      <Check size={13} /> Approve
                    </Btn>
                    <Btn variant="outline" size="sm" onClick={() => { setReviewModal({leave:l}); setReviewComment(""); }}>
                      <Edit size={13} /> Review
                    </Btn>
                  </div>
                </div>
              );
            })}
            {pendingLeaves.length === 0 && <EmptyState icon={CheckCircle} title="All caught up!" sub="No pending leave requests" />}
          </div>
        </Card>
      )}

      {/* History */}
      {tab === "history" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {[...(isAdmin ? ["Employee"] : []), "Type","From","To","Days","Applied On","Status","Action"].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(isAdmin ? allLeaves : myLeaves).map(l => {
                  const emp = employees.find(e=>e.id===l.employeeId);
                  return (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {emp && <AvatarCircle initials={emp.initials} color={emp.avatarColor} size="xs" />}
                            <span className="font-medium text-gray-800">{emp?.name}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3"><Badge variant="default" >{l.type}</Badge></td>
                      <td className="px-4 py-3 text-gray-700">{formatDateShort(l.startDate)}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDateShort(l.endDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{l.days}</td>
                      <td className="px-4 py-3 text-gray-400">{formatDateShort(l.appliedOn)}</td>
                      <td className="px-4 py-3">{leaveBadge(l.status)}</td>
                      <td className="px-4 py-3">
                        {!isAdmin && l.status === "pending" && (
                          <Btn variant="ghost" size="xs" onClick={() => cancelLeave(l.id)}>
                            <Trash2 size={11} /> Cancel
                          </Btn>
                        )}
                        {isAdmin && l.status === "pending" && (
                          <Btn variant="outline" size="xs" onClick={() => { setReviewModal({leave:l}); setReviewComment(""); }}>
                            <Edit size={11} /> Review
                          </Btn>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(isAdmin ? allLeaves : myLeaves).length === 0 && <EmptyState icon={Calendar} title="No leave requests" />}
          </div>
        </Card>
      )}

      {/* Review modal */}
      <Modal open={!!reviewModal.leave} onClose={() => setReviewModal({leave:null})} title="Review Leave Request">
        {reviewModal.leave && (() => {
          const l = reviewModal.leave!;
          const emp = employees.find(e=>e.id===l.employeeId);
          return (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                {emp && <AvatarCircle initials={emp.initials} color={emp.avatarColor} />}
                <div>
                  <p className="font-semibold text-gray-900">{emp?.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{l.type} leave · {l.days} day{l.days>1?"s":""}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">From</p><p className="font-medium">{formatDateShort(l.startDate)}</p></div>
                <div><p className="text-xs text-gray-400">To</p><p className="font-medium">{formatDateShort(l.endDate)}</p></div>
              </div>
              <div><p className="text-xs text-gray-400 mb-1">Reason</p><p className="text-sm bg-gray-50 rounded-lg p-3">{l.reason}</p></div>
              <Textarea label="Comment (optional)" value={reviewComment} placeholder="Add a note for the employee…"
                onChange={(e) => setReviewComment(e.target.value)} />
              <div className="flex gap-3 pt-2">
                <Btn variant="danger" fullWidth onClick={() => handleReview("rejected")}><XCircle size={14} /> Reject</Btn>
                <Btn variant="success" fullWidth onClick={() => handleReview("approved")}><CheckCircle size={14} /> Approve</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>
    </PageLayout>
  );
}

// ─── SALARY PAGE ──────────────────────────────────────────────────────────────

function SalaryPage() {
  const { currentUser, employees, salaryRecords, markSalaryPaid, navigate } = useApp();
  if (!currentUser) return null;
  const isAdmin = currentUser.role === "admin";

  const [monthFilter, setMonthFilter] = useState(monthStr(0));
  const [search, setSearch] = useState("");
  const [detailModal, setDetailModal] = useState<SalaryRecord | null>(null);

  const mySalary = salaryRecords.filter(s => s.employeeId === currentUser.id).sort((a,b) => b.month.localeCompare(a.month));

  const adminSalary = salaryRecords.filter(s => {
    const matchMonth = !monthFilter || s.month === monthFilter;
    const emp = employees.find(e=>e.id===s.employeeId);
    const matchSearch = !search || emp?.name.toLowerCase().includes(search.toLowerCase());
    return matchMonth && matchSearch;
  }).sort((a,b) => b.month.localeCompare(a.month));

  const totalNet = adminSalary.reduce((s,r)=>s+r.netSalary,0);
  const paidCount = adminSalary.filter(r=>r.status==="paid").length;
  const pendingCount = adminSalary.filter(r=>r.status==="pending").length;

  return (
    <PageLayout title="Salary" sub={isAdmin ? "Payroll management" : "Your salary & payslips"}
      action={isAdmin ? <Btn variant="outline" onClick={() => navigate("salary-config")}><Layers size={14}/> Pay Config</Btn> : undefined}>

      {isAdmin && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <StatCard label="Total Payroll" value={formatCurrency(totalNet)} sub={formatMonthLabel(monthFilter || monthStr(0))} icon={DollarSign} color="purple" />
            <StatCard label="Paid" value={paidCount} sub="employees" icon={CheckCircle} color="green" />
            <StatCard label="Pending" value={pendingCount} sub="employees" icon={Clock} color="amber" />
          </div>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employee…"
                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-48" />
            </div>
            <select value={monthFilter} onChange={e=>setMonthFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              {Array.from({length:6},(_,i)=>monthStr(i)).map(m=>(
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {["Employee","Basic","Allowances","Bonus","Tax","Deductions","Net Salary","Status","Action"].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {adminSalary.map(s => {
                    const emp = employees.find(e=>e.id===s.employeeId);
                    return (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {emp && <AvatarCircle initials={emp.initials} color={emp.avatarColor} size="xs" />}
                            <div>
                              <p className="font-medium text-gray-800">{emp?.name}</p>
                              <p className="text-xs text-gray-400">{emp?.position}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{formatCurrency(s.basicSalary)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{formatCurrency(s.allowances)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-emerald-600">{formatCurrency(s.bonus)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-red-500">-{formatCurrency(s.tax)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-red-500">-{formatCurrency(s.deductions)}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">{formatCurrency(s.netSalary)}</td>
                        <td className="px-4 py-3">{salaryBadge(s.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Btn variant="ghost" size="xs" onClick={() => setDetailModal(s)}>
                              <Eye size={11} />
                            </Btn>
                            {s.status === "pending" && (
                              <Btn variant="success" size="xs" onClick={() => markSalaryPaid(s.id)}>
                                <Check size={11} /> Pay
                              </Btn>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {adminSalary.length === 0 && <EmptyState icon={DollarSign} title="No salary records" />}
            </div>
          </Card>
        </>
      )}

      {!isAdmin && (
        <>
          {mySalary[0] && (
            <Card className="p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Latest Salary — {formatMonthLabel(mySalary[0].month)}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(mySalary[0].netSalary)}</p>
                </div>
                {salaryBadge(mySalary[0].status)}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: "Basic Salary", value: mySalary[0].basicSalary, color: "text-gray-900" },
                  { label: "Allowances", value: mySalary[0].allowances, color: "text-gray-900" },
                  { label: "Bonus", value: mySalary[0].bonus, color: "text-emerald-600" },
                  { label: "Tax", value: -mySalary[0].tax, color: "text-red-500" },
                  { label: "Deductions", value: -mySalary[0].deductions, color: "text-red-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className={`font-semibold text-sm font-mono ${color}`}>
                      {value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Payslip History" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {["Month","Basic","Allowances","Bonus","Tax","Deductions","Net","Status",""].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {mySalary.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{formatMonthLabel(s.month)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{formatCurrency(s.basicSalary)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{formatCurrency(s.allowances)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-emerald-600">{formatCurrency(s.bonus)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-red-500">-{formatCurrency(s.tax)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-red-500">-{formatCurrency(s.deductions)}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-900">{formatCurrency(s.netSalary)}</td>
                      <td className="px-4 py-3">{salaryBadge(s.status)}</td>
                      <td className="px-4 py-3">
                        <Btn variant="ghost" size="xs" onClick={() => setDetailModal(s)}><Eye size={11} /></Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mySalary.length === 0 && <EmptyState icon={DollarSign} title="No salary records yet" />}
            </div>
          </Card>
        </>
      )}

      {/* Detail modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="Payslip Details">
        {detailModal && (() => {
          const emp = employees.find(e=>e.id===detailModal.employeeId);
          const items = [
            { label: "Basic Salary", value: detailModal.basicSalary, type: "positive" },
            { label: "Housing Allowance", value: Math.round(detailModal.allowances * 0.6), type: "positive" },
            { label: "Transport Allowance", value: Math.round(detailModal.allowances * 0.25), type: "positive" },
            { label: "Medical Allowance", value: Math.round(detailModal.allowances * 0.15), type: "positive" },
            { label: "Performance Bonus", value: detailModal.bonus, type: "positive" },
            { label: "Income Tax", value: detailModal.tax, type: "negative" },
            { label: "Health Insurance", value: Math.round(detailModal.deductions * 0.45), type: "negative" },
            { label: "Pension Contribution", value: Math.round(detailModal.deductions * 0.55), type: "negative" },
          ];
          return (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900">{emp?.name}</p>
                  <p className="text-xs text-gray-500">{formatMonthLabel(detailModal.month)}</p>
                </div>
                {salaryBadge(detailModal.status)}
              </div>
              <div className="divide-y divide-gray-100">
                {items.filter(i=>i.value!==0).map(({ label, value, type }) => (
                  <div key={label} className="flex justify-between py-2.5 text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className={`font-mono font-medium ${type === "negative" ? "text-red-500" : "text-gray-900"}`}>
                      {type === "negative" ? "-" : ""}{formatCurrency(value)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                <span className="font-bold text-gray-900">Net Pay</span>
                <span className="font-bold text-xl text-purple-600">{formatCurrency(detailModal.netSalary)}</span>
              </div>
              {detailModal.paidOn && (
                <p className="text-xs text-gray-400 text-center">Paid on {formatDateShort(detailModal.paidOn)}</p>
              )}
            </div>
          );
        })()}
      </Modal>
    </PageLayout>
  );
}

// ─── SALARY CONFIG ────────────────────────────────────────────────────────────

function SalaryConfigPage() {
  const { employees, salaryConfigs, updateSalaryConfig, navigate } = useApp();
  const [editModal, setEditModal] = useState<SalaryConfig | null>(null);
  const [form, setForm] = useState<SalaryConfig | null>(null);
  const [saved, setSaved] = useState(false);

  const openEdit = (cfg: SalaryConfig) => {
    setEditModal(cfg);
    setForm({ ...cfg });
  };

  const handleSave = () => {
    if (!form) return;
    updateSalaryConfig(form);
    setEditModal(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const numInput = (field: keyof SalaryConfig, label: string, prefix?: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
        <input type="number" value={form?.[field] ?? ""} onChange={e=>setForm(f=>f?{...f,[field]:Number(e.target.value)}:f)}
          className={`w-full ${prefix?"pl-7":"pl-3"} pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500`} />
      </div>
    </div>
  );

  return (
    <PageLayout title="Salary Configuration" sub="Configure compensation for each employee"
      back={() => navigate("salary")}>
      {saved && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-4 text-emerald-700 text-sm">
          <CheckCircle size={14} /> Salary configuration saved successfully.
        </div>
      )}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {["Employee","Basic Salary","Housing","Transport","Medical","Tax Rate","Insurance","Pension","Bonus","Action"].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {employees.map(emp => {
                const cfg = salaryConfigs.find(c=>c.employeeId===emp.id);
                if (!cfg) return null;
                return (
                  <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AvatarCircle initials={emp.initials} color={emp.avatarColor} size="xs" />
                        <div>
                          <p className="font-medium text-gray-800">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{formatCurrency(cfg.basicSalary)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatCurrency(cfg.housingAllowance)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatCurrency(cfg.transportAllowance)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatCurrency(cfg.medicalAllowance)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{cfg.taxRate}%</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatCurrency(cfg.insuranceDeduction)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatCurrency(cfg.pensionDeduction)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-600">{formatCurrency(cfg.bonus)}</td>
                    <td className="px-4 py-3">
                      <Btn variant="outline" size="xs" onClick={() => openEdit(cfg)}><Edit size={11} /> Edit</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Salary Configuration" wide>
        {form && (() => {
          const emp = employees.find(e=>e.id===form.employeeId);
          return (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                {emp && <AvatarCircle initials={emp.initials} color={emp.avatarColor} />}
                <div>
                  <p className="font-semibold">{emp?.name}</p>
                  <p className="text-xs text-gray-500">{emp?.position} · {emp?.department}</p>
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Base & Allowances</p>
              <div className="grid grid-cols-2 gap-3">
                {numInput("basicSalary","Basic Salary","$")}
                {numInput("housingAllowance","Housing Allowance","$")}
                {numInput("transportAllowance","Transport Allowance","$")}
                {numInput("medicalAllowance","Medical Allowance","$")}
                {numInput("bonus","Monthly Bonus","$")}
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">Deductions</p>
              <div className="grid grid-cols-3 gap-3">
                {numInput("taxRate","Tax Rate (%)","%")}
                {numInput("insuranceDeduction","Insurance","$")}
                {numInput("pensionDeduction","Pension","$")}
              </div>
              {form && (
                <div className="p-3 bg-purple-50 rounded-xl text-sm">
                  <p className="text-purple-700 font-medium mb-1">Estimated Net Salary</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {formatCurrency(
                      form.basicSalary + form.housingAllowance + form.transportAllowance + form.medicalAllowance + form.bonus
                      - Math.round((form.basicSalary + form.housingAllowance + form.transportAllowance + form.medicalAllowance + form.bonus) * form.taxRate / 100)
                      - form.insuranceDeduction - form.pensionDeduction
                    )}
                  </p>
                </div>
              )}
              <div className="flex gap-3 mt-2">
                <Btn variant="outline" fullWidth onClick={() => setEditModal(null)}>Cancel</Btn>
                <Btn fullWidth onClick={handleSave}><Save size={13} /> Save Configuration</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>
    </PageLayout>
  );
}

// ─── NOTIFICATIONS PAGE ───────────────────────────────────────────────────────

function NotificationsPage() {
  const { currentUser, notifications, markNotifRead, markAllNotifsRead } = useApp();
  if (!currentUser) return null;

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const myNotifs = notifications.filter(n => n.userId === currentUser.id)
    .filter(n => filter === "all" || !n.read)
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt));

  const unreadCount = notifications.filter(n => n.userId === currentUser.id && !n.read).length;

  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <PageLayout title="Notifications" sub={`${unreadCount} unread`}
      action={unreadCount > 0 ? <Btn variant="outline" size="sm" onClick={markAllNotifsRead}><Check size={13}/> Mark all read</Btn> : undefined}>
      <div className="flex gap-2 mb-4">
        {(["all", "unread"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>{f}</button>
        ))}
      </div>

      <div className="flex flex-col gap-2 max-w-2xl">
        {myNotifs.map(n => (
          <div key={n.id}
            onClick={() => markNotifRead(n.id)}
            className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
              !n.read ? "bg-white border-purple-200 shadow-sm" : "bg-white border-gray-200 opacity-70"
            }`}>
            <div className={`mt-0.5 p-2 rounded-lg flex-shrink-0 ${
              n.type === "success" ? "bg-emerald-50" : n.type === "warning" ? "bg-amber-50" : n.type === "error" ? "bg-red-50" : "bg-blue-50"
            }`}>
              {notifIcon(n.type)}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-semibold ${!n.read ? "text-gray-900" : "text-gray-600"}`}>{n.title}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                  {!n.read && <div className="w-2 h-2 bg-purple-500 rounded-full" />}
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
            </div>
          </div>
        ))}
        {myNotifs.length === 0 && (
          <EmptyState icon={Bell} title="No notifications" sub={filter === "unread" ? "You're all caught up!" : "No notifications yet"} />
        )}
      </div>
    </PageLayout>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────

function SettingsPage() {
  const { currentUser, updateCurrentUser } = useApp();
  if (!currentUser) return null;

  const [tab, setTab] = useState<"profile" | "security" | "preferences">("profile");
  const [profile, setProfile] = useState({ name: currentUser.name, phone: currentUser.phone, address: currentUser.address });
  const [security, setSecurity] = useState({ current: "", next: "", confirm: "" });
  const [prefs, setPrefs] = useState({ emailNotifs: true, leaveUpdates: true, salaryAlerts: true, attendanceReminders: false });
  const [profileSaved, setProfileSaved] = useState(false);
  const [secError, setSecError] = useState("");
  const [secSaved, setSecSaved] = useState(false);

  const handleProfileSave = () => {
    updateCurrentUser({ name: profile.name, phone: profile.phone, address: profile.address });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handlePasswordChange = () => {
    setSecError("");
    if (!security.current || !security.next || !security.confirm) { setSecError("All fields are required."); return; }
    if (security.current !== currentUser.password) { setSecError("Current password is incorrect."); return; }
    if (security.next.length < 6) { setSecError("New password must be at least 6 characters."); return; }
    if (security.next !== security.confirm) { setSecError("New passwords do not match."); return; }
    updateCurrentUser({ password: security.next });
    setSecurity({ current: "", next: "", confirm: "" });
    setSecSaved(true);
    setTimeout(() => setSecSaved(false), 2000);
  };

  return (
    <PageLayout title="Settings" sub="Manage your account preferences">
      <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-200 p-1 w-fit">
        {(["profile", "security", "preferences"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab===t ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-xl">
        {/* Profile tab */}
        {tab === "profile" && (
          <Card>
            <CardHeader title="Personal Information" />
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <AvatarCircle initials={currentUser.initials} color={currentUser.avatarColor} size="xl" />
                <div>
                  <p className="font-semibold text-gray-900">{currentUser.name}</p>
                  <p className="text-sm text-gray-500">{currentUser.position} · {currentUser.department}</p>
                  <p className="text-xs text-gray-400">{currentUser.employeeId}</p>
                </div>
              </div>
              <Input label="Full Name" value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))} />
              <Input label="Email" value={currentUser.email} disabled className="bg-gray-100 cursor-not-allowed" />
              <Input label="Phone" value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))} placeholder="+1 (555) 000-0000" />
              <Textarea label="Address" value={profile.address} onChange={e=>setProfile(p=>({...p,address:e.target.value}))} placeholder="Your home address" />
              {profileSaved && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">
                  <CheckCircle size={14} /> Profile updated successfully!
                </div>
              )}
              <Btn onClick={handleProfileSave}><Save size={13} /> Save Changes</Btn>
            </div>
          </Card>
        )}

        {/* Security tab */}
        {tab === "security" && (
          <Card>
            <CardHeader title="Change Password" />
            <div className="p-5 flex flex-col gap-4">
              <Input label="Current Password" type="password" value={security.current}
                onChange={e=>setSecurity(s=>({...s,current:e.target.value}))} placeholder="••••••••" />
              <Input label="New Password" type="password" value={security.next}
                onChange={e=>setSecurity(s=>({...s,next:e.target.value}))} placeholder="Min. 6 characters" />
              <Input label="Confirm New Password" type="password" value={security.confirm}
                onChange={e=>setSecurity(s=>({...s,confirm:e.target.value}))} placeholder="Repeat new password" />
              {secError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  <AlertCircle size={14} /> {secError}
                </div>
              )}
              {secSaved && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">
                  <CheckCircle size={14} /> Password changed successfully!
                </div>
              )}
              <Btn onClick={handlePasswordChange}><Lock size={13} /> Update Password</Btn>
            </div>
          </Card>
        )}

        {/* Preferences tab */}
        {tab === "preferences" && (
          <Card>
            <CardHeader title="Notification Preferences" />
            <div className="p-5 flex flex-col gap-0 divide-y divide-gray-100">
              {[
                { key: "emailNotifs", label: "Email Notifications", sub: "Receive updates via email" },
                { key: "leaveUpdates", label: "Leave Request Updates", sub: "When your leave is approved or rejected" },
                { key: "salaryAlerts", label: "Salary Alerts", sub: "When your salary is processed" },
                { key: "attendanceReminders", label: "Attendance Reminders", sub: "Daily check-in reminders" },
              ].map(({ key, label, sub }) => (
                <div key={key} className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                  <button onClick={() => setPrefs(p=>({...p,[key]:!p[key as keyof typeof p]}))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${prefs[key as keyof typeof prefs] ? "bg-purple-600" : "bg-gray-300"}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${prefs[key as keyof typeof prefs] ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

function Router() {
  const { currentUser, page } = useApp();

  if (!currentUser) {
    if (page === "signup") return <SignUpPage />;
    return <SignInPage />;
  }

  const isAdmin = currentUser.role === "admin";

  switch (page) {
    case "signin": return <SignInPage />;
    case "signup": return <SignUpPage />;
    case "emp-dashboard": return <EmployeeDashboard />;
    case "admin-dashboard": return isAdmin ? <AdminDashboard /> : <EmployeeDashboard />;
    case "employees": return isAdmin ? <EmployeesPage /> : <EmployeeProfilePage />;
    case "employee-profile": return <EmployeeProfilePage />;
    case "attendance": return <AttendancePage />;
    case "time-off": return <TimeOffPage />;
    case "salary": return <SalaryPage />;
    case "salary-config": return isAdmin ? <SalaryConfigPage /> : <SalaryPage />;
    case "notifications": return <NotificationsPage />;
    case "settings": return <SettingsPage />;
    default: return <EmployeeDashboard />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
