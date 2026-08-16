const fs = require('fs');
let code = fs.readFileSync('src/components/CalendarModal.tsx', 'utf8');

code = code.replace(/import \{ calculateStreak, cn, isHabitDayFrozen, formatDate \} from '\.\.\/lib\/utils';/, "import { calculateStreak, cn, isHabitDayFrozen, formatDate, checkDayStatus } from '../lib/utils';");

fs.writeFileSync('src/components/CalendarModal.tsx', code);
