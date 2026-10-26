let inputValue = "";
let history = [];

// 色が変わった瞬間の記録
let colorMarks = {
    yellow: null,
    orange: null
};

const SAVE_KEY = "dq_damage_counter_v1";

// データをブラウザに保存
function saveData() {
    const data = {
        maxHP: maxHPInput.value,
        inputValue: inputValue,
        history: history,
        colorMarks: colorMarks
    };

    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("保存に失敗しました", error);
    }
}

// 保存済みデータを読み込む
function loadData() {
    try {
        const saved = localStorage.getItem(SAVE_KEY);

        if (!saved) return;

        const data = JSON.parse(saved);

        if (typeof data.maxHP === "string") {
            maxHPInput.value = data.maxHP;
        }

        if (typeof data.inputValue === "string") {
            inputValue = data.inputValue;
        }

        if (Array.isArray(data.history)) {
            history = data.history.filter(item =>
                (item.type === "damage" || item.type === "heal") &&
                Number.isSafeInteger(item.amount) &&
                item.amount > 0
            );
        }

        if (data.colorMarks &&
            typeof data.colorMarks === "object") {

            for (const color of ["yellow", "orange"]) {
                const mark = data.colorMarks[color];

                if (mark &&
                    Number.isSafeInteger(mark.before) &&
                    Number.isSafeInteger(mark.after) &&
                    Number.isSafeInteger(mark.historyIndex) &&
                    mark.before >= 0 &&
                    mark.after > mark.before &&
                    mark.historyIndex <= history.length) {

                    colorMarks[color] = mark;
                }
            }
        }
    } catch (error) {
        console.error("保存データの読み込みに失敗しました", error);
    }
}


const maxHPInput = document.getElementById("maxHP");
const amountDisplay = document.getElementById("amountDisplay");
const historyList = document.getElementById("historyList");

// 累計ダメージ（回復分は差し引く）
function getTotalDamage() {
    return history.reduce((total, item) => {
        return total + (item.type === "damage"
            ? item.amount
            : -item.amount);
    }, 0);
}


// 指定した履歴件数までの累計ダメージ
function getDamageAt(count) {
    return history.slice(0, count).reduce((total, item) => {
        return total + (item.type === "damage"
            ? item.amount
            : -item.amount);
    }, 0);
}

// HP色変化を記録
function recordColor(color) {
    if (colorMarks[color] !== null) {
        if (!confirm("この色変化の記録を上書きする？")) {
            return;
        }
    }

    // ダメージ履歴がない場合は記録しない
    if (history.length === 0) {
        alert("先にダメージを記録してね！");
        return;
    }

    const last = history[history.length - 1];

    if (last.type !== "damage") {
        alert("色が変わった攻撃の直後に記録してね！");
        return;
    }

    // 色が変わる直前と直後のダメージ
    const after = getTotalDamage();
    const before = after - last.amount;

    colorMarks[color] = {
        before,
        after,
        historyIndex: history.length
    };

    updateDisplay();
}

// HP推定範囲を計算
function calculateHPEstimate() {
    let minHP = 1;
    let maxHP = Infinity;

    const yellow = colorMarks.yellow;
    const orange = colorMarks.orange;

    if (yellow) {
        // 黄色：残りHPが50%以下
        minHP = Math.max(minHP, 2 * yellow.before + 1);
        maxHP = Math.min(maxHP, 2 * yellow.after);
    }

    if (orange) {
        // オレンジ：残りHPが25%以下
        minHP = Math.max(
            minHP,
            Math.floor(4 * orange.before / 3) + 1
        );

        maxHP = Math.min(
            maxHP,
            Math.floor(4 * orange.after / 3)
        );
    }

    return { minHP, maxHP };
}

// 色変化と推定HPの表示更新
function updateColorDisplay() {
    const records = document.getElementById("colorRecords");
    const estimate = document.getElementById("estimatedHP");
    const detail = document.getElementById("estimateDetail");

    const yellow = colorMarks.yellow;
    const orange = colorMarks.orange;

    let lines = [];

    if (yellow) {
        lines.push(
            `🟡 黄色：${yellow.before.toLocaleString()} → ` +
            `${yellow.after.toLocaleString()} ダメージ`
        );
    }

    if (orange) {
        lines.push(
            `🟠 オレンジ：${orange.before.toLocaleString()} → ` +
            `${orange.after.toLocaleString()} ダメージ`
        );
    }

    records.textContent = lines.length
        ? lines.join(" / ")
        : "色変化の記録なし";

    if (!yellow && !orange) {
        estimate.textContent = "記録待ち";
        detail.textContent = "";
        return;
    }

    const { minHP, maxHP } = calculateHPEstimate();

    if (minHP > maxHP) {
        estimate.textContent = "推定不可";
        detail.textContent =
            "記録が矛盾しています。色変化のタイミングを確認してね。";
        return;
    }

    if (!Number.isFinite(maxHP)) {
        estimate.textContent = minHP.toLocaleString() + " 以上";
    } else if (minHP === maxHP) {
        estimate.textContent = minHP.toLocaleString();
    } else {
        estimate.textContent =
            minHP.toLocaleString() + " ～ " +
            maxHP.toLocaleString();
    }

    detail.textContent =
        "色変化の境界から推定した最大HPの範囲";
}

// 画面更新
function updateDisplay() {
    const total = getTotalDamage();
    const maxHP = Number(maxHPInput.value);
    const hasHP = maxHPInput.value !== "" && maxHP > 0;

    document.getElementById("hpLabel").textContent =
        hasHP ? "残りHP" : "累計ダメージ";

    document.getElementById("display").textContent =
        (hasHP ? maxHP - total : total).toLocaleString();

    document.getElementById("totalDisplay").textContent =
        "累計ダメージ（回復差引）：" + total.toLocaleString();

    amountDisplay.textContent =
        inputValue ? Number(inputValue).toLocaleString() : "0";

    historyList.innerHTML = "";

    [...history].reverse().forEach(item => {
        const li = document.createElement("li");
        li.textContent = (item.type === "damage" ? "−" : "＋")
            + item.amount.toLocaleString()
            + (item.type === "damage" ? " ダメージ" : " 回復");
        historyList.appendChild(li);
    });

    updateColorDisplay();
    saveData();
}

// 電卓の数字ボタン
document.querySelectorAll("[data-key]").forEach(button => {
    button.addEventListener("click", () => {
        const key = button.dataset.key;

        if (key === "C") {
            inputValue = "";
        } else if (key === "⌫") {
            inputValue = inputValue.slice(0, -1);
        } else if (inputValue.length < 8) {
            inputValue += key;
        }

        updateDisplay();
    });
});


document.getElementById("yellowBtn").addEventListener(
    "click", () => recordColor("yellow")
);

document.getElementById("orangeBtn").addEventListener(
    "click", () => recordColor("orange")
);

document.getElementById("clearColorsBtn").addEventListener(
    "click", () => {
        if (!confirm("色変化の記録を解除する？")) {
            return;
        }

        colorMarks = {
            yellow: null,
            orange: null
        };

        updateDisplay();
    }
);

// ダメージ・回復の共通処理
function applyValue(type) {
    const amount = Number(inputValue);

    if (!Number.isFinite(amount) || amount <= 0) {
        return;
    }

    let actualAmount = amount;

    // 回復は累計ダメージを超えないようにする
    if (type === "heal") {
        const totalDamage = getTotalDamage();

        actualAmount = Math.min(
            amount,
            Math.max(0, totalDamage)
        );
    }

    if (actualAmount > 0) {
        history.push({
            type,
            amount: actualAmount
        });
    }

    inputValue = "";
    updateDisplay();
}



document.getElementById("damageBtn").addEventListener(
    "click", () => applyValue("damage")
);

document.getElementById("healBtn").addEventListener(
    "click", () => applyValue("heal")
);

// 直前の入力を取り消す
document.getElementById("undoBtn").addEventListener("click", () => {
    if (history.length === 0) return;

    history.pop();

    // 取り消した攻撃に紐づく色変化も解除
    for (const color of ["yellow", "orange"]) {
        const mark = colorMarks[color];

        if (mark && mark.historyIndex > history.length) {
            colorMarks[color] = null;
        }
    }

    updateDisplay();
});

// 戦闘リセット
document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("戦闘データをリセットする？")) {
        return;
    }

    history = [];
    inputValue = "";

    // 色変化の記録もリセット
    colorMarks = {
        yellow: null,
        orange: null
    };

    // 初期HPは消さない！
    updateDisplay();
});


maxHPInput.addEventListener("input", updateDisplay);

// 起動時に前回のデータを復元
loadData();
updateDisplay();

