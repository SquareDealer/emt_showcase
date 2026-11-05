// The CRM app imports every page eagerly (client/src/App.tsx), so ALL feature stylesheets are
// global there — e.g. `.back-link` of the work-order page is styled by clients/card.css. A scene
// that imports one view would otherwise miss rules the real screen has. Same order as the app's
// module evaluation (DFS from main.tsx); dashboard.css is video-only and goes last.
import '@crm/components/app-shell.css';
import '@crm/components/schedule.css';
import '@crm/features/auth/login.css';
import '@crm/features/clients/clients.css';
import '@crm/features/clients/card.css';
import '@crm/features/work-orders/wo.css';
import '@crm/features/board/board.css';
import '@crm/features/price-list/price-list.css';
import '@crm/features/calendar/calendar.css';
import '@crm/features/archive/archive.css';
import '@crm/features/import/import.css';
import '@crm/features/dashboard/dashboard.css';
