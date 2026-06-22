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
function showRegister() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("register-form").style.display = "block";
  document.getElementById("login-error").textContent = "";
}

function showLogin() {
  document.getElementById("register-form").style.display = "none";
  document.getElementById("login-form").style.display = "block";
  document.getElementById("register-error").textContent = "";
}

async function register() {
  const username = document.getElementById("reg-username").value;
  const password = document.getElementById("reg-password").value;
  const password2 = document.getElementById("reg-password2").value;
  const errEl = document.getElementById("register-error");

  if (!username || !password) { errEl.textContent = "ユーザー名とパスワードを入力してください"; return; }
  if (password !== password2) { errEl.textContent = "パスワードが一致しません"; return; }

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (!res.ok) { errEl.textContent = data.error; return; }

  alert("登録しました！ログインしてください");
  showLogin();
}

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
      { id: "admin-register", label: "📷 写真登録" },
      { id: "list",           label: "📋 登録一覧" },
      { id: "users",          label: "👤 ユーザー管理" },
      { id: "records",        label: "📊 記録" },
    ];
  } else if (role === 'family') {
    return [
      { id: "register", label: "📷 写真登録" },
      { id: "list",     label: "📋 登録一覧" },
    ];
  } else {
    return [
      { id: "game",     label: "🎮 ゲーム" },
      { id: "register", label: "📷 写真登録" },
      { id: "list",     label: "📋 登録一覧" },
      { id: "records",  label: "📊 記録" },
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
    document.getElementById("file-drop-label").textContent = "📁 タップして写真を選ぶ";
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
    document.getElementById("admin-file-drop-label").textContent = "📁 タップして写真を選ぶ";
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
    list.innerHTML = "<p class='empty-text'>まだ登録されていません</p>";
    return;
  }

  people.forEach(p => {
    const div = document.createElement("div");
    div.className = "person-card";
    div.innerHTML = `
      <img src="/api/get_image/${p.id}" alt="${p.name}">
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
  const roleClass = { user: "role-user", admin: "role-admin", family: "role-family" };

  users.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-row";
    div.innerHTML = `
      <div>
        <span class="user-name">${u.username}</span>
        <span class="role-badge ${roleClass[u.role]}">${roleLabel[u.role]}</span>
        ${u.linked_user_id ? `<span style="font-size:12px; color:#999; margin-left:4px;">紐づけID:${u.linked_user_id}</span>` : ""}
      </div>
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

  // すべてのゲームフェーズを隠す
  hideAllPhases();
  showMemorizePhase();
}

function hideAllPhases() {
  ['game-start', 'game-memorize', 'game-answer', 'game-correct', 'game-wrong'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

function showMemorizePhase() {
  const grid = document.getElementById("memorize-grid");
  grid.innerHTML = "";

  gameTargets.forEach(p => {
    const div = document.createElement("div");
    div.className = "memory-card";
    div.innerHTML = `
      <img src="/api/get_image/${p.id}" alt="${p.name}">
      <p class="card-person-name">${p.name}</p>
    `;
    grid.appendChild(div);
  });

  document.getElementById("game-memorize").style.display = "block";

  let sec = 5;
  const countEl = document.getElementById("memory-countdown");
  countEl.textContent = sec;

  const timer = setInterval(() => {
    sec--;
    if (sec > 0) {
      countEl.textContent = sec;
    } else {
      clearInterval(timer);
      countEl.textContent = "";
      document.getElementById("game-memorize").style.display = "none";
      showAnswerPhase();
    }
  }, 1000);
}

function showAnswerPhase() {
  document.getElementById("answer-question").textContent = `「${answerPerson.name}」はどっち？`;
  const grid = document.getElementById("answer-grid");
  grid.innerHTML = "";

  [...gameTargets].sort(() => Math.random() - 0.5).forEach(p => {
    const div = document.createElement("div");
    div.className = "answer-card";
    div.innerHTML = `<img src="/api/get_image/${p.id}" alt="">`;
    div.onclick = () => checkAnswer(p);
    grid.appendChild(div);
  });

  document.getElementById("game-answer").style.display = "block";
}

async function checkAnswer(chosen) {
  // クリック無効化
  document.querySelectorAll(".answer-card").forEach(c => c.onclick = null);

  const isCorrect = chosen.id === answerPerson.id;

  // 記録保存
  await fetch("/api/save_record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correct: isCorrect ? 1 : 0, total: 1 })
  });

  hideAllPhases();

  if (isCorrect) {
    // 正解画面
    document.getElementById("correct-photo").src = `/api/get_image/${answerPerson.id}`;
    document.getElementById("correct-photo").alt = answerPerson.name;
    document.getElementById("correct-name").textContent = answerPerson.name;
    document.getElementById("correct-photo-label").textContent = `「${answerPerson.name}」`;
    document.getElementById("correct-detail").textContent = `正解！「${answerPerson.name}」さんを選びました。`;
    document.getElementById("game-correct").style.display = "block";
  } else {
    // 不正解画面
    document.getElementById("wrong-chosen-photo").src = `/api/get_image/${chosen.id}`;
    document.getElementById("wrong-chosen-name").textContent = chosen.name || "？";

    const correct = gameTargets.find(p => p.id === answerPerson.id);
    document.getElementById("wrong-correct-photo").src = `/api/get_image/${answerPerson.id}`;
    document.getElementById("wrong-correct-name").textContent = answerPerson.name;

    document.getElementById("game-wrong").style.display = "block";
  }
}

// =====================
// 記録
// =====================
async function loadRecords() {
  const res = await fetch("/api/get_records");
  const records = await res.json();
  const list = document.getElementById("records-list");

  if (records.length === 0) {
    list.innerHTML = "<p class='empty-text'>記録がありません</p>";
    return;
  }

  let html = `<table class="records-table">
    <thead>
      <tr>
        ${currentUser.role === 'admin' ? '<th>ユーザー</th>' : ""}
        <th>結果</th>
        <th>日時</th>
      </tr>
    </thead><tbody>`;

  records.forEach(r => {
    const date = new Date(r.played_at).toLocaleString('ja-JP');
    html += `<tr>
      ${currentUser.role === 'admin' ? `<td>${r.username}</td>` : ""}
      <td class="${r.correct ? 'record-correct' : 'record-wrong'}">
        ${r.correct ? "正解 ✓" : "不正解 ✗"}
      </td>
      <td class="record-date">${date}</td>
    </tr>`;
  });

  html += "</tbody></table>";
  list.innerHTML = html;
}
