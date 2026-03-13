/**
 * anomaly.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Analisa o comportamento de leitura de um usuário e calcula um "Score de
 * Integridade" (0–100) baseado em 5 indicadores:
 *
 *  1. Conclusões instantâneas   — start_date = end_date
 *  2. Adicionado e lido no dia  — book.created_at = reading.end_date
 *  3. Velocidade impossível     — >1 000 páginas/dia
 *  4. Velocidade muito alta     — 500–1 000 páginas/dia
 *  5. Pico de adição em massa   — ≥10 livros num único dia
 *  6. Outlier estatístico (σ)   — books_read > média + 3σ da plataforma
 *
 * Score 80-100 → excelente | 60-79 → bom | 40-59 → atenção | 0-39 → alerta
 * ─────────────────────────────────────────────────────────────────────────────
 */

const db = require("../config/database");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
}

function median(sorted) {
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

// ─────────────────────────────────────────────────────────────────────────────
// Resposta padrão quando há dados insuficientes
// ─────────────────────────────────────────────────────────────────────────────
function insufficientData(totalFinished, totalBooks) {
    return {
        score: 100,
        level: "excellent",
        color: "green",
        emoji: "✅",
        message: "Continue registrando suas leituras para obter uma análise de integridade personalizada.",
        flags: [],
        platformStats: null,
        stats: { totalFinished, totalBooks, instantReads: 0, instantPct: 0, sameDayAddAndRead: 0, impossiblyFastCount: 0, veryFastCount: 0 },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────────────────────────────────────

function analyzeReadingIntegrity(userId, tenantId) {
    /* ── Dados base ─────────────────────────────────────────────────────── */
    const up = db.prepare("SELECT * FROM user_progresses WHERE user_id = ? AND tenant_id = ?").get(userId, tenantId);

    const totalFinished =
        db.prepare("SELECT COUNT(*) as cnt FROM reading_progresses WHERE tenant_id = ? AND end_date IS NOT NULL").get(tenantId)?.cnt || 0;

    const totalBooks = db.prepare("SELECT COUNT(*) as cnt FROM books WHERE tenant_id = ?").get(tenantId)?.cnt || 0;

    // Poucas amostras → não há base para análise
    if (totalFinished < 2 && totalBooks < 5) {
        return insufficientData(totalFinished, totalBooks);
    }

    const flags = [];
    let scoreDeduction = 0;

    /* ── 1. Conclusões instantâneas (start_date = end_date) ─────────────── */
    const instantReads =
        db
            .prepare(
                `SELECT COUNT(*) as cnt
             FROM reading_progresses
             WHERE tenant_id = ? AND end_date IS NOT NULL AND start_date = end_date`,
            )
            .get(tenantId)?.cnt || 0;

    const instantPct = totalFinished > 0 ? (instantReads / totalFinished) * 100 : 0;

    if (instantPct >= 60 && instantReads >= 3) {
        flags.push({
            type: "instant_reads",
            severity: "high",
            label: "Conclusões no mesmo dia",
            detail: `${instantReads} de ${totalFinished} leituras (${Math.round(instantPct)}%) foram marcadas como concluídas no mesmo dia em que foram iniciadas.`,
        });
        scoreDeduction += Math.min(30, Math.round(instantPct * 0.35));
    } else if (instantPct >= 30 && instantReads >= 2) {
        flags.push({
            type: "instant_reads",
            severity: "medium",
            label: "Conclusões no mesmo dia",
            detail: `${instantReads} leitura(s) concluída(s) no mesmo dia em que foram iniciadas (${Math.round(instantPct)}% do total).`,
        });
        scoreDeduction += Math.min(15, Math.round(instantPct * 0.25));
    }

    /* ── 2. Adicionado e imediatamente marcado como lido ────────────────── */
    const sameDayAddAndRead =
        db
            .prepare(
                `SELECT COUNT(*) as cnt
             FROM reading_progresses rp
             JOIN books b ON b.id = rp.book_id
             WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL
               AND DATE(b.created_at) = DATE(rp.end_date)`,
            )
            .get(tenantId)?.cnt || 0;

    const sameDayPct = totalFinished > 0 ? (sameDayAddAndRead / totalFinished) * 100 : 0;

    if (sameDayPct >= 50 && sameDayAddAndRead >= 3) {
        flags.push({
            type: "add_and_read_same_day",
            severity: "high",
            label: "Adicionado e concluído no mesmo dia",
            detail: `${sameDayAddAndRead} livro(s) foram adicionados à biblioteca e marcados como lidos no mesmo dia.`,
        });
        scoreDeduction += Math.min(25, Math.round(sameDayPct * 0.3));
    } else if (sameDayPct >= 25 && sameDayAddAndRead >= 2) {
        flags.push({
            type: "add_and_read_same_day",
            severity: "medium",
            label: "Adicionado e concluído no mesmo dia",
            detail: `${sameDayAddAndRead} livro(s) foram cadastrados e marcados como concluídos no mesmo dia.`,
        });
        scoreDeduction += Math.min(12, Math.round(sameDayPct * 0.2));
    }

    /* ── 3 & 4. Velocidade de leitura impossível / muito alta ───────────── */
    const readingsWithDuration = db
        .prepare(
            `SELECT rp.id, b.pages,
                    CAST(julianday(rp.end_date) - julianday(rp.start_date) AS INTEGER) AS days,
                    b.title
             FROM reading_progresses rp
             JOIN books b ON b.id = rp.book_id
             WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL
               AND rp.start_date IS NOT NULL AND rp.start_date != rp.end_date
               AND b.pages > 50`,
        )
        .all(tenantId);

    const impossiblyFast = readingsWithDuration.filter((r) => r.pages / Math.max(1, r.days) > 1_000);
    const veryFast = readingsWithDuration.filter((r) => {
        const ppd = r.pages / Math.max(1, r.days);
        return ppd > 500 && ppd <= 1_000;
    });

    if (impossiblyFast.length > 0) {
        flags.push({
            type: "impossible_speed",
            severity: "high",
            label: "Velocidade de leitura impossível",
            detail: `${impossiblyFast.length} livro(s) com mais de 1.000 páginas lidas por dia — fisicamente impossível.`,
        });
        scoreDeduction += Math.min(25, impossiblyFast.length * 8);
    } else if (veryFast.length > 0) {
        flags.push({
            type: "very_fast_reads",
            severity: "low",
            label: "Velocidade de leitura muito alta",
            detail: `${veryFast.length} livro(s) concluídos com mais de 500 páginas por dia — improvável para leitura convencional.`,
        });
        scoreDeduction += Math.min(8, veryFast.length * 2);
    }

    /* ── 5. Pico de adição em massa ─────────────────────────────────────── */
    const peakRows = db
        .prepare(
            `SELECT DATE(created_at) as day, COUNT(*) as cnt
             FROM books WHERE tenant_id = ?
             GROUP BY day HAVING cnt >= 10
             ORDER BY cnt DESC LIMIT 3`,
        )
        .all(tenantId);

    if (peakRows.length > 0) {
        const maxPeak = peakRows[0].cnt;
        flags.push({
            type: "bulk_add_spike",
            severity: maxPeak >= 20 ? "high" : "medium",
            label: "Adição em massa de livros",
            detail: `Pico de ${maxPeak} livros adicionados em um único dia. Isso pode indicar cadastro artificial para inflar estat­ísticas.`,
        });
        scoreDeduction += maxPeak >= 20 ? 12 : 6;
    }

    /* ── 6. Desvio estatístico (z-score em relação à plataforma) ─────────── */
    if (up && up.books_read > 0) {
        const allProgresses = db.prepare("SELECT books_read FROM user_progresses WHERE books_read > 0").all();
        if (allProgresses.length > 1) {
            const values = allProgresses.map((u) => u.books_read);
            const m = mean(values);
            const s = stdDev(values);
            const z = s > 0 ? (up.books_read - m) / s : 0;

            if (z > 3) {
                flags.push({
                    type: "statistical_outlier",
                    severity: "medium",
                    label: "Outlier estatístico",
                    detail: `Seu número de livros lidos está ${z.toFixed(1)}σ acima da média da plataforma (média: ${Math.round(m)} livros).`,
                    zScore: Math.round(z * 10) / 10,
                    platformMean: Math.round(m),
                    userValue: up.books_read,
                });
                scoreDeduction += 8;
            }
        }
    }

    /* ── Score final ─────────────────────────────────────────────────────── */
    const score = Math.max(0, Math.min(100, 100 - scoreDeduction));

    let level, color, emoji, message;
    if (score >= 80) {
        level = "excellent";
        color = "green";
        emoji = "✅";
        message = "Seu perfil de leitura parece autêntico! Seus registros refletem uma jornada genuína de leituras. Continue assim!";
    } else if (score >= 60) {
        level = "good";
        color = "yellow";
        emoji = "💛";
        message =
            "Seu ritmo de leitura está acima da média da plataforma. Certifique-se de que seus registros reflitam suas leituras reais — isso torna a experiência mais valiosa para você do que qualquer posição no ranking.";
    } else if (score >= 40) {
        level = "warning";
        color = "orange";
        emoji = "⚠️";
        message =
            "Detectamos padrões incomuns nos seus registros de leitura. Lembrete importante: a biblioteca pessoal é mais útil quando reflete sua jornada real. Estar no topo de um ranking com dados inflados não representa crescimento como leitor.";
    } else {
        level = "alert";
        color = "red";
        emoji = "🚨";
        message =
            "Vários registros apresentam padrões atípicos: conclusões instantâneas, velocidade impossível ou cadastros em massa. Rankings artificiais não refletem seu crescimento real como leitor — e só você sabe o que realmente foi lido. Dados autênticos tornam a experiência significativa.";
    }

    /* ── Estatísticas da plataforma para contexto ────────────────────────── */
    let platformStats = null;
    try {
        const allUp = db.prepare("SELECT books_read, total_pages_read FROM user_progresses WHERE books_read > 0").all();
        if (allUp.length > 0) {
            const bookValues = allUp.map((u) => u.books_read);
            const pageValues = allUp.map((u) => u.total_pages_read);

            const allDurations = db
                .prepare(
                    `SELECT CAST(julianday(end_date) - julianday(start_date) AS INTEGER) AS days
                     FROM reading_progresses
                     WHERE end_date IS NOT NULL AND start_date IS NOT NULL AND start_date != end_date
                     ORDER BY days`,
                )
                .all()
                .map((r) => Math.max(0, r.days))
                .sort((a, b) => a - b);

            platformStats = {
                avgBooksRead: Math.round(mean(bookValues) * 10) / 10,
                avgPagesRead: Math.round(mean(pageValues)),
                medianReadingDays: median(allDurations),
                totalUsers: allUp.length,
            };
        }
    } catch (_) {
        // Não crítico — deixa como null
    }

    return {
        score,
        level,
        color,
        emoji,
        message,
        flags,
        platformStats,
        stats: {
            totalFinished,
            totalBooks,
            instantReads,
            instantPct: Math.round(instantPct),
            sameDayAddAndRead,
            impossiblyFastCount: impossiblyFast.length,
            veryFastCount: veryFast.length,
        },
    };
}

module.exports = { analyzeReadingIntegrity };
