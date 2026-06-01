from flask import Flask, request, jsonify, send_from_directory, session
import os
from functools import wraps
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "memoryname-secret-key-2024")

DATABASE_URL = os.environ.get("DATABASE_URL")

# --- DB接続 ---
def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn

# --- DB初期化 ---
def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'admin', 'family')),
        linked_user_id INTEGER
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY,
        name TEXT,
        image BYTEA,
        owner_user_id INTEGER NOT NULL
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS game_records (
        id SERIAL PRIMARY KEY,
        player_user_id INTEGER NOT NULL,
        correct INTEGER NOT NULL,
        total INTEGER NOT NULL,
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    c.execute("SELECT id FROM users WHERE username = 'admin'")
    if not c.fetchone():
        c.execute("INSERT INTO users (username, password, role) VALUES (%s, %s, %s)",
                  ('admin', 'admin123', 'admin'))

    conn.commit()
    conn.close()
    print("DB初期化完了")

# --- 認証デコレーター ---
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "ログインが必要です"}), 401
        return f(*args, **kwargs)
    return decorated

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({"error": "ログインが必要です"}), 401
            if session.get('role') not in roles:
                return jsonify({"error": "権限がありません"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

# --- ページ配信 ---
@app.route("/")
def home():
    return send_from_directory(".", "index.html")

@app.route("/game")
def game():
    return send_from_directory(".", "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)

# =====================
# 認証API
# =====================

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "入力が不正です"}), 400

    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password, role) VALUES (%s, %s, %s)",
                  (username, password, "user"))
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        return jsonify({"error": "そのユーザー名は既に使われています"}), 400
    conn.close()
    return jsonify({"message": "登録しました"})

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username = %s AND password = %s", (username, password))
    user = c.fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "ユーザー名またはパスワードが違います"}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    session['role'] = user['role']
    session['linked_user_id'] = user['linked_user_id']

    return jsonify({
        "message": "ログイン成功",
        "user": {
            "id": user['id'],
            "username": user['username'],
            "role": user['role'],
            "linked_user_id": user['linked_user_id']
        }
    })

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "ログアウトしました"})

@app.route("/api/me", methods=["GET"])
def me():
    if 'user_id' not in session:
        return jsonify({"error": "未ログイン"}), 401
    return jsonify({
        "id": session['user_id'],
        "username": session['username'],
        "role": session['role'],
        "linked_user_id": session['linked_user_id']
    })

# =====================
# ユーザー管理API
# =====================

@app.route("/api/users", methods=["GET"])
@role_required('admin')
def get_users():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, username, role, linked_user_id FROM users")
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/users", methods=["POST"])
@role_required('admin')
def create_user():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    role = data.get("role")
    linked_user_id = data.get("linked_user_id")

    if not username or not password or role not in ('user', 'admin', 'family'):
        return jsonify({"error": "入力が不正です"}), 400

    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password, role, linked_user_id) VALUES (%s, %s, %s, %s)",
                  (username, password, role, linked_user_id))
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        return jsonify({"error": "そのユーザー名は既に使われています"}), 400
    conn.close()
    return jsonify({"message": "ユーザーを作成しました"})

@app.route("/api/users/<int:user_id>", methods=["DELETE"])
@role_required('admin')
def delete_user(user_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "削除しました"})

# =====================
# 写真管理API
# =====================

def get_target_user_id():
    role = session.get('role')
    if role == 'family':
        return session.get('linked_user_id')
    return session.get('user_id')

@app.route("/api/add_person", methods=["POST"])
@login_required
def add_person():
    role = session.get('role')
    name = request.form.get("name")
    image = request.files.get("image")

    if not name or not image:
        return jsonify({"error": "name and image required"}), 400

    if role == 'admin':
        owner_id = request.form.get("owner_user_id", session['user_id'])
    else:
        owner_id = get_target_user_id()

    if not owner_id:
        return jsonify({"error": "紐づけ先ユーザーが設定されていません"}), 400

    image_data = image.read()
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO people (name, image, owner_user_id) VALUES (%s, %s, %s)",
              (name, psycopg2.Binary(image_data), owner_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "saved"})

@app.route("/api/get_people", methods=["GET"])
@login_required
def get_people():
    role = session.get('role')
    conn = get_db()
    c = conn.cursor()

    if role == 'admin':
        target_id = request.args.get("owner_user_id")
        if target_id:
            c.execute("SELECT id, name, owner_user_id FROM people WHERE owner_user_id = %s", (target_id,))
        else:
            c.execute("SELECT id, name, owner_user_id FROM people")
    else:
        owner_id = get_target_user_id()
        c.execute("SELECT id, name, owner_user_id FROM people WHERE owner_user_id = %s", (owner_id,))

    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/get_image/<int:person_id>", methods=["GET"])
@login_required
def get_image(person_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT image FROM people WHERE id = %s", (person_id,))
    row = c.fetchone()
    conn.close()

    if row is None:
        return "Not found", 404

    return bytes(row["image"]), 200, {"Content-Type": "image/jpeg"}

@app.route("/api/delete_person/<int:person_id>", methods=["DELETE"])
@login_required
def delete_person(person_id):
    role = session.get('role')
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT owner_user_id FROM people WHERE id = %s", (person_id,))
    row = c.fetchone()

    if row is None:
        conn.close()
        return jsonify({"error": "見つかりません"}), 404

    if role != 'admin' and row['owner_user_id'] != get_target_user_id():
        conn.close()
        return jsonify({"error": "権限がありません"}), 403

    c.execute("DELETE FROM people WHERE id = %s", (person_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "deleted"})

# =====================
# 記録API
# =====================

@app.route("/api/save_record", methods=["POST"])
@login_required
def save_record():
    data = request.get_json()
    correct = data.get("correct", 0)
    total = data.get("total", 0)
    player_id = session['user_id']

    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO game_records (player_user_id, correct, total) VALUES (%s, %s, %s)",
              (player_id, correct, total))
    conn.commit()
    conn.close()
    return jsonify({"message": "記録しました"})

@app.route("/api/get_records", methods=["GET"])
@login_required
def get_records():
    role = session.get('role')
    conn = get_db()
    c = conn.cursor()

    if role == 'admin':
        c.execute("""
            SELECT r.id, u.username, r.correct, r.total, r.played_at
            FROM game_records r JOIN users u ON r.player_user_id = u.id
            ORDER BY r.played_at DESC LIMIT 50
        """)
    else:
        c.execute("""
            SELECT r.id, u.username, r.correct, r.total, r.played_at
            FROM game_records r JOIN users u ON r.player_user_id = u.id
            WHERE r.player_user_id = %s
            ORDER BY r.played_at DESC LIMIT 50
        """, (session['user_id'],))

    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

# gunicorn用DB初期化
with app.app_context():
    init_db()

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
