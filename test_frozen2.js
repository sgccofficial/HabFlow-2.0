const today = new Date();
const todayStr = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0')
].join('-');

const h = { frozenSince: '2026-09-02' };

const newFrozenDates = new Set();
if (h.frozenSince) {
  const [y, m, d] = h.frozenSince.split('-');
  let curr = new Date(Number(y), Number(m)-1, Number(d));
  const [ty, tm, td] = todayStr.split('-');
  const end = new Date(Number(ty), Number(tm)-1, Number(td));
  curr.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  while (curr < end) {
      function formatDate(date) {
          const d = new Date(date);
          let month = '' + (d.getMonth() + 1);
          let day = '' + d.getDate();
          const year = d.getFullYear();
          if (month.length < 2) month = '0' + month;
          if (day.length < 2) day = '0' + day;
          return [year, month, day].join('-');
      }
      newFrozenDates.add(formatDate(curr));
      curr.setDate(curr.getDate() + 1);
  }
}
newFrozenDates.delete(todayStr); 
console.log(Array.from(newFrozenDates));
