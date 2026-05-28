let currentUser = null;

// =====================
// 初期化
// =====================
window.onload = async () => {
  const res = await fetch("/api/me");
  if (res.ok) {
    currentUser = await res.json();
    showMainScreen();
  }
};

// =====================
// ログイン・ログアウト
// =====================
async function login() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (!res.ok) {
    document.getElementById("login-error").textContent = data.error;
    return;
  }

  currentUser = data.user;
  showMainScreen();
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  currentUser = null;
  document.getElementById("main-screen").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("login-password").value = "";
  document.getElementById("login-error").textContent = "";
}

// =====================
// 画面切り替え
// =====================
function showMainScreen() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("main-screen").style.display = "block";

  const roleLabel = { user: "利用者", admin: "管理者", family: "家族" };
  document.getElementById("header-user").textContent =
    `${currentUser.username}（${roleLabel[currentUser.role]}）`;

  buildTabs();
}

function buildTabs() {
  const tabBar = document.getElementById("tab-bar");
  tabBar.innerHTML = "";

  const tabs = getTabs();
  tabs.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (i === 0 ? " active" : "");
    btn.textContent = t.label;
    btn.onclick = () => switchTab(t.id);
    tabBar.appendChild(btn);
  });

  switchTab(tabs[0].id);
}

function getTabs() {
  const role = currentUser.role;
  if (role === 'admin') {
    return [
      { id: "admin-register", label: "写真登録" },
      { id: "list",           label: "登録一覧" },
      { id: "users",          label: "ユーザー管理" },
      { id: "records",        label: "記録" },
    ];
  } else if (role === 'family') {
    return [
      { id: "register", label: "写真登録" },
      { id: "list",     label: "登録一覧" },
    ];
  } else {
    return [
      { id: "game",     label: "ゲーム" },
      { id: "register", label: "写真登録" },
      { id: "list",     label: "登録一覧" },
      { id: "records",  label: "記録" },
    ];
  }
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));

  document.getElementById("tab-" + tabId).classList.add("active");

  const tabs = getTabs();
  const idx = tabs.findIndex(t => t.id === tabId);
  document.querySelectorAll(".tab-btn")[idx]?.classList.add("active");

  if (tabId === "list") {
    if (currentUser.role === 'admin') {
      document.getElementById("admin-user-select").style.display = "block";
      loadUserSelectOptions("list-user-select", true);
    }
    loadPeople();
  }
  if (tabId === "admin-register") loadUserSelectOptions("admin-owner-select", false);
  if (tabId === "users") { loadUsers(); loadUserSelectOptions("new-linked-user", false); }
  if (tabId === "records") loadRecords();
}

// =====================
// 写真管理
// =====================
async function addPerson() {
  const name = document.getElementById("person-name").value;
  const image = document.getElementById("person-image").files[0];
  if (!name || !image) { alert("名前と画像を入力してください"); return; }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("image", image);

  const res = await fetch("/api/add_person", { method: "POST", body: formData });
  const data = await res.json();
  alert(res.ok ? "追加しました" : data.error);
  if (res.ok) {
    document.getElementById("person-name").value = "";
    document.getElementById("person-image").value = "";
  }
}

async function adminAddPerson() {
  const name = document.getElementById("admin-person-name").value;
  const image = document.getElementById("admin-person-image").files[0];
  const owner = document.getElementById("admin-owner-select").value;
  if (!name || !image || !owner) { alert("全て入力してください"); return; }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("image", image);
  formData.append("owner_user_id", owner);

  const res = await fetch("/api/add_person", { method: "POST", body: formData });
  const data = await res.json();
  alert(res.ok ? "追加しました" : data.error);
  if (res.ok) {
    document.getElementById("admin-person-name").value = "";
    document.getElementById("admin-person-image").value = "";
  }
}

async function loadPeople() {
  let url = "/api/get_people";
  if (currentUser.role === 'admin') {
    const sel = document.getElementById("list-user-select");
    if (sel && sel.value) url += `?owner_user_id=${sel.value}`;
  }

  const res = await fetch(url);
  const people = await res.json();
  const list = document.getElementById("registered-list");
  list.innerHTML = "";

  if (people.length === 0) {
    list.innerHTML = "<p style='color:#999;'>まだ登録されていません</p>";
    return;
  }

  people.forEach(p => {
    const div = document.createElement("div");
    div.className = "person-card";
    div.innerHTML = `
      <img src="/api/get_image/${p.id}" class="thumb">
      <p>${p.name}</p>
      <button class="delete-btn" onclick="deletePerson(${p.id})">削除</button>
    `;
    list.appendChild(div);
  });
}

async function deletePerson(id) {
  if (!confirm("削除しますか？")) return;
  const res = await fetch(`/api/delete_person/${id}`, { method: "DELETE" });
  const data = await res.json();
  alert(res.ok ? "削除しました" : data.error);
  if (res.ok) loadPeople();
}

// =====================
// ユーザー管理（管理者）
// =====================
async function loadUsers() {
  const res = await fetch("/api/users");
  const users = await res.json();
  const list = document.getElementById("user-list");
  list.innerHTML = "";

  const roleLabel = { user: "利用者", admin: "管理者", family: "家族" };

  users.forEach(u => {
    const div = document.createElement("div");
    div.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #eee;";
    div.innerHTML = `
      <span style="font-size:14px;">
        <strong>${u.username}</strong>
        <span style="color:#666; margin-left:6px;">${roleLabel[u.role]}</span>
        ${u.linked_user_id ? `<span style="color:#aaa; font-size:12px;"> 紐づけID:${u.linked_user_id}</span>` : ""}
      </span>
      <button class="delete-btn" onclick="deleteUser(${u.id})">削除</button>
    `;
    list.appendChild(div);
  });
}

async function createUser() {
  const username = document.getElementById("new-username").value;
  const password = document.getElementById("new-password").value;
  const role = document.getElementById("new-role").value;
  const linked = document.getElementById("new-linked-user").value;

  const body = { username, password, role };
  if (role === 'family' && linked) body.linked_user_id = parseInt(linked);

  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  alert(res.ok ? "ユーザーを作成しました" : data.error);
  if (res.ok) {
    document.getElementById("new-username").value = "";
    document.getElementById("new-password").value = "";
    loadUsers();
  }
}

async function deleteUser(id) {
  if (!confirm("このユーザーを削除しますか？")) return;
  const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
  const data = await res.json();
  alert(res.ok ? "削除しました" : data.error);
  if (res.ok) loadUsers();
}

function toggleLinkedUser() {
  const role = document.getElementById("new-role").value;
  document.getElementById("linked-user-group").style.display =
    role === 'family' ? "block" : "none";
}

async function loadUserSelectOptions(selectId, includeAll) {
  const res = await fetch("/api/users");
  if (!res.ok) return;
  const users = await res.json();
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const current = sel.value;
  sel.innerHTML = includeAll ? '<option value="">全員</option>' : "";

  users.filter(u => u.role === 'user').forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.username;
    sel.appendChild(opt);
  });

  if (current) sel.value = current;
}

// =====================
// ゲーム
// =====================
let gameTargets = [];
let answerPerson = null;
let correctCount = 0;
let totalCount = 0;

async function startMemoryGame() {
  const res = await fetch("/api/get_people");
  const people = await res.json();

  if (people.length < 2) {
    alert("最低2人登録してください");
    return;
  }

  const shuffled = [...people].sort(() => Math.random() - 0.5);
  gameTargets = shuffled.slice(0, 2);
  answerPerson = gameTargets[Math.floor(Math.random() * 2)];

  document.getElementById("start-btn").disabled = true;
  document.getElementById("next-btn").style.display = "none";
  document.getElementById("memory-result").textContent = "";

  showMemorizePhase();
}

function showMemorizePhase() {
  const grid = document.getElementById("memory-grid");
  grid.innerHTML = "";
  document.getElementById("memory-question").textContent = "この2人を覚えてください！";

  gameTargets.forEach(p => {
    const div = document.createElement("div");
    div.className = "person-card";
    div.innerHTML = `
      <img src="/api/get_image/${p.id}" class="thumb">
      <p><strong>${p.name}</strong></p>
    `;
    grid.appendChild(div);
  });

  let sec = 5;
  document.getElementById("memory-countdown").textContent = `${sec} 秒後に出題します`;

  const timer = setInterval(() => {
    sec--;
    if (sec > 0) {
      document.getElementById("memory-countdown").textContent = `${sec} 秒後に出題します`;
    } else {
      clearInterval(timer);
      document.getElementById("memory-countdown").textContent = "";
      showAnswerPhase();
    }
  }, 1000);
}

function showAnswerPhase() {
  document.getElementById("memory-question").textContent = `「${answerPerson.name}」はどっち？`;
  const grid = document.getElementById("memory-grid");
  grid.innerHTML = "";

  [...gameTargets].sort(() => Math.random() - 0.5).forEach(p => {
    const img = document.createElement("img");
    img.src = `/api/get_image/${p.id}`;
    img.className = "thumb game-thumb";
    img.onclick = () => checkAnswer(p.id);
    grid.appendChild(img);
  });
}

async function checkAnswer(id) {
  document.querySelectorAll(".game-thumb").forEach(img => img.onclick = null);
  totalCount++;

  const result = document.getElementById("memory-result");
  if (id === answerPerson.id) {
    correctCount++;
    result.textContent = "正解！🎉";
    result.style.color = "green";
    document.getElementById("next-btn").style.display = "inline-block";
  } else {
    result.textContent = `不正解… 正解は「${answerPerson.name}」でした`;
    result.style.color = "red";
    document.getElementById("start-btn").disabled = false;
  }

  document.getElementById("memory-question").textContent = "";

  // 記録を保存
  await fetch("/api/save_record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correct: id === answerPerson.id ? 1 : 0, total: 1 })
  });
}

// =====================
// 記録
// =====================
async function loadRecords() {
  const res = await fetch("/api/get_records");
  const records = await res.json();
  const list = document.getElementById("records-list");

  if (records.length === 0) {
    list.innerHTML = "<p style='color:#999;'>記録がありません</p>";
    return;
  }

  let html = `<table style="width:100%; border-collapse:collapse; font-size:14px;">
    <thead>
      <tr style="border-bottom:2px solid #eee;">
        ${currentUser.role === 'admin' ? '<th style="text-align:left; padding:6px;">ユーザー</th>' : ""}
        <th style="text-align:left; padding:6px;">結果</th>
        <th style="text-align:left; padding:6px;">日時</th>
      </tr>
    </thead><tbody>`;

  records.forEach(r => {
    const date = new Date(r.played_at).toLocaleString('ja-JP');
    html += `<tr style="border-bottom:1px solid #f0f0f0;">
      ${currentUser.role === 'admin' ? `<td style="padding:6px;">${r.username}</td>` : ""}
      <td style="padding:6px; color:${r.correct ? 'green' : '#e57373'}">
        ${r.correct ? "正解 ✓" : "不正解 ✗"}
      </td>
      <td style="padding:6px; color:#999;">${date}</td>
    </tr>`;
  });

  html += "</tbody></table>";
  list.innerHTML = html;
}