// Centralized API Client Layer for Member 3 Frontend -> Member 2 Backend
const API_BASE = window.location.origin;

class ApiClient {
  static getAuthHeader() {
    const token = localStorage.getItem("access_token");
    return token ? { "Authorization": `Bearer ${token}` } : {};
  }

  static async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...ApiClient.getAuthHeader(),
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("access_token");
          showLoginView();
          throw new Error("Your session has expired. Please sign in again.");
        }
        throw new Error(data.detail || data.message || `API Error (${response.status})`);
      }
      return data;
    } catch (err) {
      console.error(`API Request Failed [${endpoint}]:`, err);
      throw err;
    }
  }

  static async login(email, password) {
    return ApiClient.request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  static async signup(payload) {
    return ApiClient.request("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  static async getProfile() {
    return ApiClient.request("/api/v1/employees/me");
  }

  static async getLeaves() {
    return ApiClient.request("/api/v1/leaves");
  }

  static async createLeave(payload) {
    return ApiClient.request("/api/v1/leaves", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  static async getAttendance() {
    return ApiClient.request("/api/v1/attendance/daily");
  }

  static async getWeeklyAttendance() {
    return ApiClient.request("/api/v1/attendance/weekly");
  }

  static async getPayroll() {
    return ApiClient.request("/api/v1/payroll");
  }

  static async sendCopilotChat(message, confirm = false, confirm_token = null) {
    return ApiClient.request("/api/v1/ai/copilot/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        confirm,
        confirm_token
      })
    });
  }
}

// UI State & Application Controller
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("access_token");
  if (token) {
    initApp();
  } else {
    showLoginView();
  }

  // Setup Event Listeners
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  const signupForm = document.getElementById("signupForm");
  if (signupForm) signupForm.addEventListener("submit", handleSignup);
  
  document.getElementById("leaveForm").addEventListener("submit", handleCreateLeave);
  document.getElementById("btnSendChat").addEventListener("click", handleSendChat);
  document.getElementById("chatInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSendChat();
  });
  document.getElementById("btnLogout").addEventListener("click", handleLogout);
});

function toggleAuthTab(tab) {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const btnSignIn = document.getElementById("tabBtnSignIn");
  const btnSignUp = document.getElementById("tabBtnSignUp");
  const alertEl = document.getElementById("loginAlert");
  const successEl = document.getElementById("loginSuccessAlert");

  if (alertEl) alertEl.style.display = "none";
  if (successEl) successEl.style.display = "none";

  if (tab === 'signin') {
    loginForm.style.display = "block";
    signupForm.style.display = "none";
    btnSignIn.style.borderBottomColor = "var(--primary-accent)";
    btnSignIn.style.color = "var(--text-main)";
    btnSignUp.style.borderBottomColor = "transparent";
    btnSignUp.style.color = "var(--text-muted)";
  } else {
    loginForm.style.display = "none";
    signupForm.style.display = "block";
    btnSignUp.style.borderBottomColor = "var(--primary-accent)";
    btnSignUp.style.color = "var(--text-main)";
    btnSignIn.style.borderBottomColor = "transparent";
    btnSignIn.style.color = "var(--text-muted)";
  }
}

function fillDemoAccount(role) {
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPassword");

  if (role === 'employee') {
    emailInput.value = "test.employee@dayflow.com";
    passInput.value = "TestPassword123!";
  } else if (role === 'dev') {
    emailInput.value = "charlie.dev@company.com";
    passInput.value = "DevPassword123!";
  } else if (role === 'hr') {
    emailInput.value = "hr.bob@company.com";
    passInput.value = "DevPassword123!";
  } else if (role === 'admin') {
    emailInput.value = "admin@company.com";
    passInput.value = "DevPassword123!";
  }
}

function showLoginView() {
  document.getElementById("loginView").style.display = "flex";
  document.getElementById("appView").style.display = "none";
}

function showAppView() {
  document.getElementById("loginView").style.display = "none";
  document.getElementById("appView").style.display = "flex";
}

async function handleLogin(e) {
  e.preventDefault();
  const alertEl = document.getElementById("loginAlert");
  const successEl = document.getElementById("loginSuccessAlert");
  if (alertEl) alertEl.style.display = "none";
  if (successEl) successEl.style.display = "none";

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await ApiClient.login(email, password);
    localStorage.setItem("access_token", res.access_token);
    await initApp();
  } catch (err) {
    if (alertEl) {
      alertEl.textContent = err.message || "Invalid credentials or server unavailable.";
      alertEl.style.display = "block";
    }
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const alertEl = document.getElementById("loginAlert");
  const successEl = document.getElementById("loginSuccessAlert");
  if (alertEl) alertEl.style.display = "none";
  if (successEl) successEl.style.display = "none";

  const payload = {
    name: document.getElementById("signupName").value,
    email: document.getElementById("signupEmail").value,
    password: document.getElementById("signupPassword").value,
    department: document.getElementById("signupDept").value,
    role: document.getElementById("signupRole").value
  };

  try {
    const res = await ApiClient.signup(payload);
    if (successEl) {
      successEl.textContent = `✅ ${res.message}`;
      successEl.style.display = "block";
    }
    // Switch to Sign In tab with pre-filled credentials
    toggleAuthTab('signin');
    document.getElementById("loginEmail").value = payload.email;
    document.getElementById("loginPassword").value = payload.password;
  } catch (err) {
    if (alertEl) {
      alertEl.textContent = err.message || "Sign up failed.";
      alertEl.style.display = "block";
    }
  }
}

function handleLogout() {
  localStorage.removeItem("access_token");
  currentUser = null;
  showLoginView();
}

async function initApp() {
  try {
    showAppView();
    currentUser = await ApiClient.getProfile();
    const name = currentUser.name || "Sarah Jenkins";
    const email = currentUser.email || "test.employee@dayflow.com";
    const dept = currentUser.department || "Engineering";
    const role = currentUser.role || "EMPLOYEE";
    const initial = name.charAt(0).toUpperCase();

    document.getElementById("userNameDisplay").textContent = name;
    document.getElementById("userAvatar").textContent = initial;

    if (document.getElementById("cardAvatar")) document.getElementById("cardAvatar").textContent = initial;
    if (document.getElementById("profName")) document.getElementById("profName").textContent = name;
    if (document.getElementById("profEmail")) document.getElementById("profEmail").textContent = email;
    if (document.getElementById("profDept")) document.getElementById("profDept").textContent = dept;
    if (document.getElementById("profRole")) document.getElementById("profRole").textContent = role;
    if (document.getElementById("profTitle")) {
      document.getElementById("profTitle").textContent = role === "ADMIN" ? "System Administrator" : role === "HR" ? "HR Lead Manager" : "Software Engineer";
    }

    // Load initial data
    await loadLeaves();
    await loadAttendance();
    await loadPayroll();
  } catch (err) {
    console.error("Initialization failed:", err);
    handleLogout();
  }
}

function switchTab(tabName) {
  const tabs = ["dashboard", "leaves", "attendance", "payroll"];
  tabs.forEach(t => {
    const section = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (section) section.style.display = t === tabName ? "block" : "none";
  });

  const links = document.querySelectorAll(".sidebar .nav-link");
  links.forEach(link => {
    link.classList.toggle("active", link.textContent.toLowerCase().includes(tabName));
  });
}

async function loadLeaves() {
  try {
    const balances = await ApiClient.getLeaves();
    const tbody = document.getElementById("leaveBalanceTable");
    tbody.innerHTML = "";

    Object.keys(balances).forEach(type => {
      const b = balances[type];
      if (typeof b === "object") {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${type}</strong></td>
          <td>${b.total}</td>
          <td>${b.used}</td>
          <td>${b.pending}</td>
          <td><span class="badge badge-success">${b.available} Days</span></td>
        `;
        tbody.appendChild(tr);
      }
    });

    if (balances.CASUAL) {
      document.getElementById("statLeaveBalance").textContent = `${balances.CASUAL.available} Days`;
    }
  } catch (err) {
    console.error("Failed to load leaves:", err);
  }
}

async function handleCreateLeave(e) {
  e.preventDefault();
  const alertEl = document.getElementById("globalAlert");
  alertEl.style.display = "none";

  const payload = {
    leave_type: document.getElementById("leaveType").value,
    start_date: document.getElementById("startDate").value,
    end_date: document.getElementById("endDate").value,
    reason: document.getElementById("leaveReason").value
  };

  try {
    const res = await ApiClient.createLeave(payload);
    alertEl.className = "alert alert-success";
    alertEl.textContent = `✅ Leave application created successfully! Status: ${res.state || 'PENDING'}`;
    alertEl.style.display = "block";
    await loadLeaves();
    document.getElementById("leaveForm").reset();
  } catch (err) {
    alertEl.className = "alert alert-danger";
    alertEl.textContent = `❌ ${err.message}`;
    alertEl.style.display = "block";
  }
}

async function loadAttendance() {
  try {
    const daily = await ApiClient.getAttendance();
    const weekly = await ApiClient.getWeeklyAttendance();

    document.getElementById("weeklyPresent").textContent = `${weekly.total_days_present || 5} Days`;
    document.getElementById("statAttendance").textContent = `${weekly.total_days_present || 20} Days`;

    const tbody = document.getElementById("attendanceTable");
    tbody.innerHTML = "";

    const records = daily.records || [
      { user_id: "usr_88392", status: "PRESENT", check_in: "09:05" },
      { user_id: "usr_99102", status: "LATE", check_in: "10:45" }
    ];

    records.forEach(r => {
      const tr = document.createElement("tr");
      const badgeClass = r.status === "PRESENT" ? "badge-success" : "badge-warning";
      tr.innerHTML = `
        <td>${r.user_id}</td>
        <td><span class="badge ${badgeClass}">${r.status}</span></td>
        <td>${r.check_in || "09:00"}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load attendance:", err);
  }
}

async function loadPayroll() {
  try {
    const pay = await ApiClient.getPayroll();
    const p = Array.isArray(pay) ? pay[0] : pay;

    document.getElementById("payrollPeriod").textContent = p.pay_period || "2026-08";
    document.getElementById("payBasic").textContent = `$${(p.basic_salary || 7000).toLocaleString()}`;
    document.getElementById("payAllowances").textContent = `$${(p.allowances || 1000).toLocaleString()}`;
    document.getElementById("payDeductions").textContent = `$${(p.deductions || 500).toLocaleString()}`;
    document.getElementById("payNet").textContent = `$${(p.net_salary || 7500).toLocaleString()}`;
    document.getElementById("statGrossPay").textContent = `$${(p.gross_salary || 8000).toLocaleString()}`;
  } catch (err) {
    console.error("Failed to load payroll:", err);
  }
}

async function handleSendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;

  appendChatMessage("user", msg);
  input.value = "";

  try {
    const res = await ApiClient.sendCopilotChat(msg);
    appendChatMessage("ai", res.message);

    if (res.intent === "ACT_PREVIEW" && res.suggested_action) {
      appendConfirmationCard(res.suggested_action.parameters);
    }
  } catch (err) {
    appendChatMessage("ai", `❌ ${err.message}`);
  }
}

function appendChatMessage(sender, text) {
  const container = document.getElementById("chatMessages");
  const bubble = document.createElement("div");
  bubble.className = `msg-bubble msg-${sender}`;
  bubble.innerHTML = text.replace(/\n/g, "<br>");
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function appendConfirmationCard(params) {
  const container = document.getElementById("chatMessages");
  const card = document.createElement("div");
  card.className = "glass-panel";
  card.style.padding = "0.8rem";
  card.style.marginTop = "0.5rem";

  card.innerHTML = `
    <p style="font-size: 0.85rem; margin-bottom: 0.5rem;">Confirm leave application?</p>
    <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="confirmAction('${params.confirm_token}')">Confirm</button>
  `;
  container.appendChild(card);
  container.scrollTop = container.scrollHeight;
}

async function confirmAction(token) {
  try {
    const res = await ApiClient.sendCopilotChat("Confirm", true, token);
    appendChatMessage("ai", res.message);
    await loadLeaves();
  } catch (err) {
    appendChatMessage("ai", `❌ Confirmation failed: ${err.message}`);
  }
}
