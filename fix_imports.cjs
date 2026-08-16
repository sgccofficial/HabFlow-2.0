const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

code = code.replace(/import \{ TrendingUp, Award, CalendarDays, Activity, Share2, CheckCircle2 \} from 'lucide-react';/, "import { TrendingUp, Award, CalendarDays, Activity, Share2, CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';");

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
