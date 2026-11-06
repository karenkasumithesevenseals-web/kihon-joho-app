/**
 * daily-order.js … 「今日の1問」で出す順番（科目Aの問題ID）。
 *
 * 役割: 開始日（logic.js の DAILY_START）から1日1問ずつ、この順に出す。年度・分野が偏らないように混ぜてある。
 * 注意: 公開したあとは並べ替えない（過去の日の問題が変わる）。問題を足したときは、ここに足さなくても末尾に自動で入る。
 * 作り方: tools/make_daily_order.js（科目A 80問）。
 */
const FE_DAILY_ORDER = [
  "R06A_Q03", "R05A_Q16", "R07A_Q11", "R05A_Q14",
  "R08A_Q07", "R05A_Q09", "R07A_Q16", "R05A_Q08",
  "R07A_Q10", "R06A_Q18", "R07A_Q06", "R07A_Q14",
  "R05A_Q03", "R05A_Q06", "R07A_Q18", "R08A_Q03",
  "R06A_Q15", "R05A_Q20", "R07A_Q01", "R05A_Q13",
  "R07A_Q03", "R05A_Q05", "R05A_Q18", "R08A_Q01",
  "R05A_Q11", "R05A_Q17", "R06A_Q02", "R06A_Q13",
  "R06A_Q11", "R07A_Q04", "R07A_Q19", "R07A_Q13",
  "R07A_Q05", "R06A_Q19", "R06A_Q06", "R08A_Q12",
  "R07A_Q12", "R06A_Q04", "R08A_Q19", "R06A_Q09",
  "R08A_Q06", "R08A_Q17", "R06A_Q10", "R06A_Q14",
  "R05A_Q04", "R08A_Q10", "R08A_Q16", "R08A_Q09",
  "R08A_Q02", "R06A_Q20", "R07A_Q09", "R08A_Q13",
  "R05A_Q15", "R08A_Q11", "R06A_Q17", "R05A_Q12",
  "R08A_Q08", "R05A_Q19", "R06A_Q08", "R08A_Q15",
  "R06A_Q07", "R06A_Q01", "R08A_Q20", "R06A_Q12",
  "R07A_Q07", "R07A_Q17", "R05A_Q01", "R08A_Q14",
  "R06A_Q05", "R07A_Q02", "R06A_Q16", "R08A_Q05",
  "R07A_Q08", "R08A_Q18", "R08A_Q04", "R07A_Q15",
  "R05A_Q02", "R05A_Q10", "R07A_Q20", "R05A_Q07"
];

if (typeof module !== 'undefined' && module.exports) { module.exports = FE_DAILY_ORDER; }
