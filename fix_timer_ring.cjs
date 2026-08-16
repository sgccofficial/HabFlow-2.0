const fs = require('fs');
let code = fs.readFileSync('src/components/TimerPage.tsx', 'utf8');

const target = `{/* SVG Ring */}
            {mode === 'countdown' ? (
              <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="4" className="stroke-gray-100 dark:stroke-gray-800" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" strokeWidth="4" 
                  className="stroke-indigo-500 transition-all duration-1000 ease-linear"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * progress) / 100}
                />
              </svg>
            ) : (
              <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="4" className="stroke-gray-100 dark:stroke-gray-800" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" strokeWidth="4" 
                  className="stroke-emerald-500 transition-all duration-1000 ease-linear"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={swIsRunning ? 0 : 283}
                />
              </svg>
            )}`;

const replace = `{/* SVG Ring */}
            {mode === 'countdown' && (
              <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="4" className="stroke-gray-100 dark:stroke-gray-800" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" strokeWidth="4" 
                  className="stroke-indigo-500 transition-all duration-1000 ease-linear"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * progress) / 100}
                />
              </svg>
            )}`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/TimerPage.tsx', code);
