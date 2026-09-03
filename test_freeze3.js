const todayStr = "2026-09-02";

const h = {
  id: "1",
  isFrozen: true,
  frozenSince: "2026-09-02",
  frozenDates: ["2026-09-02"] // Suppose it ALREADY had todayStr for some reason
};

const newFrozenDates = new Set(h.frozenDates || []);
if (h.frozenSince) {
  const [y, m, d] = h.frozenSince.split('-');
  let curr = new Date(Number(y), Number(m)-1, Number(d));
  const [ty, tm, td] = todayStr.split('-');
  const end = new Date(Number(ty), Number(tm)-1, Number(td));
  curr.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  while (curr < end) {
    newFrozenDates.add(
      `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`
    );
    curr.setDate(curr.getDate() + 1);
  }
}
newFrozenDates.delete(todayStr); // Ensure today is not frozen when unfreezing

console.log(Array.from(newFrozenDates));
