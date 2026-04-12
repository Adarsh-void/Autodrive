import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  Calendar, 
  Wrench, 
  Package, 
  FileText, 
  LogOut,
  Bell,
  Settings,
  ExternalLink,
  Receipt,
  Download,
  FileSpreadsheet,
  FileJson
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: 'admin' | 'user';
  onLogout: () => void;
  badges?: Record<string, number>;
}

export default function Sidebar({ activeTab, setActiveTab, role, onLogout, badges = {} }: SidebarProps) {
  const adminLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Manage Users', icon: Users },
    { id: 'vehicles', label: 'All Vehicles', icon: Car },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'jobs', label: 'Service Jobs', icon: Wrench },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const userLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my-vehicles', label: 'My Vehicles', icon: Car },
    { id: 'book', label: 'Book Service', icon: Calendar },
    { id: 'status', label: 'Track Status', icon: Wrench },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const links = role === 'admin' ? adminLinks : userLinks;

  return (
    <div className="w-64 border-r border-border flex flex-col h-screen sticky top-0 bg-card/50 backdrop-blur-xl">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Wrench className="text-primary-foreground h-4 w-4" />
        </div>
        <span className="font-bold text-lg tracking-tight">SmartGarage</span>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {links.map((link) => (
          <button
            key={link.id}
            onClick={() => setActiveTab(link.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative",
              activeTab === link.id 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
            {badges[link.id] > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-card shadow-sm animate-pulse" />
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-1">
        {role === 'admin' && (
          <Link
            to="/dashboard"
            target="_blank"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-all mb-2"
          >
            <ExternalLink className="h-4 w-4" />
            Customer View
          </Link>
        )}
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            activeTab === 'settings'
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
