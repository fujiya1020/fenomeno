// 締切保存
import fs from "fs";

const FILE = "./tasks.json";

export function loadTasks() {
    if (!fs.existsSync(FILE)) return{};
    try {
        const data = fs.readFileSync(FILE, "utf8");
        return JSON.parse(data);
    } catch (e) {
        console.error("タスク読み込み失敗:", e);
        return {};
    }
}

export function saveTasks(tasks) {
    try {
        fs.writeFileSync(FILE, JSON.stringify(tasks, null, 2));
    } catch (e) {
        console.error("締切保存失敗", e);
    }
}