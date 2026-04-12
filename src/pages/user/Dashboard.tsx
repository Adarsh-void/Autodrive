import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Vehicle, Appointment, Job, Notification } from '../../types';
import Sidebar from '../../components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../lib/utils';
import { 
  User, 
  Mail, 
  Smartphone, 
  Settings as SettingsIcon,
  Car, 
  Calendar, 
  Wrench, 
  Bell, 
  Plus, 
  History,
  Shield,
  FileText,
  ChevronRight,
  Clock,
  X,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Receipt,
  Download,
  FileSpreadsheet,
  FileJson,
  Edit2,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { predictNextService } from '../../services/geminiService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { SERVICE_CATEGORIES, SERVICE_PRICES } from '../../constants/services';

interface UserDashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function UserDashboard({ profile, onLogout }: UserDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedVehicleForDocs, setSelectedVehicleForDocs] = useState<Vehicle | null>(null);
  const [selectedVehicleForHistory, setSelectedVehicleForHistory] = useState<Vehicle | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    const vQuery = query(collection(db, 'vehicles'), where('ownerId', '==', profile.uid));
    const unsubVehicles = onSnapshot(vQuery, (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    }, (error) => console.error("Error fetching vehicles:", error));

    const aQuery = query(collection(db, 'appointments'), where('userId', '==', profile.uid));
    const unsubAppointments = onSnapshot(aQuery, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
    }, (error) => console.error("Error fetching appointments:", error));

    const nQuery = query(collection(db, 'notifications'), where('userId', '==', profile.uid));
    const unsubNotifications = onSnapshot(nQuery, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    }, (error) => console.error("Error fetching notifications:", error));

    const jQuery = query(collection(db, 'jobs'), where('userId', '==', profile.uid));
    const unsubJobs = onSnapshot(jQuery, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Job)));
    }, (error) => console.error("Error fetching jobs:", error));

    return () => {
      unsubVehicles();
      unsubAppointments();
      unsubNotifications();
      unsubJobs();
    };
  }, [profile.uid]);

  const handleLogout = async () => {
    await auth.signOut();
    onLogout();
  };

  const nextPredictedService = React.useMemo(() => {
    const vehiclesWithPredictions = vehicles.filter(v => !!v.nextServiceDate);
    if (vehiclesWithPredictions.length === 0) return null;
    
    return [...vehiclesWithPredictions].sort((a, b) => 
      new Date(a.nextServiceDate!).getTime() - new Date(b.nextServiceDate!).getTime()
    )[0];
  }, [vehicles]);

  const isOverdue = nextPredictedService?.nextServiceDate && new Date(nextPredictedService.nextServiceDate) < new Date();
  const isDueSoon = nextPredictedService?.nextServiceDate && !isOverdue && (new Date(nextPredictedService.nextServiceDate).getTime() - new Date().getTime()) < 14 * 24 * 60 * 60 * 1000;

  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-zinc-900 text-white min-h-[400px] flex items-center">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=2000" 
            alt="Car Maintenance" 
            className="w-full h-full object-cover opacity-50"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-transparent" />
        </div>
        
        <div className="relative z-10 p-8 md:p-16 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30 hover:bg-primary/20 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              Premium Care
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-[1.1] tracking-tight">
              Keep Your Vehicle <br />
              <span className="text-primary">Running Like New</span>
            </h1>
            <p className="text-zinc-400 text-lg mb-8 max-w-md leading-relaxed">
              Professional maintenance and repair services tailored to your vehicle's specific needs. Book your next appointment in seconds.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={() => setActiveTab('book')} 
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl px-8 h-14 text-base font-bold shadow-lg shadow-primary/20"
              >
                Book Maintenance Now
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setActiveTab('my-vehicles')}
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-2xl px-8 h-14 text-base font-bold backdrop-blur-md"
              >
                View My Garage
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Maintenance Tips */}
        <Card className="bg-card border-border lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Maintenance Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">Tire Care</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Check tire pressure monthly to improve fuel efficiency by up to 3%.</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">Battery Health</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Extreme temperatures can drain battery life. Get a voltage test before winter.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* My Vehicles */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">My Vehicles</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAddVehicle(true)} className="text-muted-foreground hover:text-foreground">
              <Plus className="h-4 w-4 mr-1" /> Add New
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.map((v) => (
              <Card 
                key={v.id} 
                className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => setActiveTab('my-vehicles')}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-background border border-border group-hover:border-primary/30 transition-all">
                      <Car className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <Badge variant="secondary">{v.fuelType}</Badge>
                  </div>
                  <h4 className="text-lg font-bold">{v.name}</h4>
                  <p className="text-sm text-muted-foreground">Purchased in {v.year}</p>
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xs">
                        <p className="text-muted-foreground">Last Service</p>
                        <p className="text-foreground">{v.lastServiceDate || 'N/A'}</p>
                      </div>
                      <div className="text-xs text-right">
                        <p className="text-muted-foreground">Odometer</p>
                        <p className="text-foreground font-mono">{v.totalKm?.toLocaleString() || '---'} KM</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 h-9 rounded-xl border-border text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVehicleForDocs(v);
                        }}
                      >
                        <FileText className="h-3 w-3 mr-1.5" />
                        Documents
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 h-9 rounded-xl border-border text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVehicleForHistory(v);
                        }}
                      >
                        <History className="h-3 w-3 mr-1.5" />
                        History
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {vehicles.length === 0 && (
              <div className="col-span-full py-12 border-2 border-dashed border-border rounded-3xl flex flex-col items-center justify-center text-muted-foreground">
                <Car className="h-12 w-12 mb-4 opacity-20" />
                <p>No vehicles registered yet</p>
                <Button variant="link" onClick={() => setShowAddVehicle(true)}>Register your first vehicle</Button>
              </div>
            )}
          </div>
        </div>

        {/* Service Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Service Status</h3>
            <Button variant="link" size="sm" onClick={() => setActiveTab('status')} className="text-primary">View All</Button>
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-6 space-y-6">
              {appointments.length > 0 || jobs.length > 0 ? (
                <div className="space-y-6">
                  {appointments.filter(a => a.status === 'pending').map((app) => (
                    <div key={app.id} className="relative pl-8 pb-6 last:pb-0">
                      <div className="absolute left-0 top-0 h-full w-px bg-border" />
                      <div className="absolute left-[-4px] top-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium">{app.serviceType}</p>
                          <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/20">Awaiting Approval</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(app.date).toLocaleDateString()} at {new Date(app.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                  {jobs.filter(j => vehicles.some(v => v.id === j.vehicleId)).map((job) => (
                    <div key={job.id} className="relative pl-8 pb-6 last:pb-0">
                      <div className="absolute left-0 top-0 h-full w-px bg-border" />
                      <div className={cn(
                        "absolute left-[-4px] top-1 w-2 h-2 rounded-full",
                        job.status === 'completed' ? "bg-green-500" : 
                        job.status === 'in-progress' ? "bg-blue-500 animate-pulse" : "bg-red-500 animate-pulse"
                      )} />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{job.tasks.join(', ')}</p>
                          <Badge variant="outline" className={cn(
                            "text-[10px] uppercase tracking-wider",
                            job.status === 'completed' ? "text-green-500 border-green-500/20" : 
                            job.status === 'in-progress' ? "text-blue-500 border-blue-500/20" : "text-red-500 border-red-500/20"
                          )}>
                            {job.status}
                          </Badge>
                        </div>
                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all duration-500",
                              job.status === 'completed' ? "w-full bg-green-500" : 
                              job.status === 'in-progress' ? "w-1/2 bg-blue-500" : "w-1/4 bg-red-500"
                            )}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">Vehicle: {vehicles.find(v => v.id === job.vehicleId)?.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No active service status</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        role="user" 
        onLogout={handleLogout} 
        badges={{
          notifications: notifications.filter(n => !n.read).length
        }}
      />
      
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {profile.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Button 
                variant="outline" 
                size="icon" 
                className="border-border bg-card"
                onClick={() => setShowNotifications(true)}
              >
                <Bell className="h-4 w-4" />
              </Button>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-[10px] font-bold text-primary-foreground rounded-full flex items-center justify-center">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <div className="text-right">
                <p className="text-sm font-medium">{profile.name}</p>
                <p className="text-xs text-muted-foreground">Customer</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                {profile.name[0]}
              </div>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'invoices' && <InvoicesSection jobs={jobs} vehicles={vehicles} profile={profile} />}
        {activeTab === 'my-vehicles' && (
          <MyVehicles 
            vehicles={vehicles} 
            onAdd={() => setShowAddVehicle(true)} 
            onShowDocs={setSelectedVehicleForDocs}
            onShowHistory={setSelectedVehicleForHistory}
          />
        )}
        {activeTab === 'book' && <BookServiceSection vehicles={vehicles} userId={profile.uid} onSuccess={() => setActiveTab('dashboard')} />}
        {activeTab === 'status' && <StatusSection appointments={appointments} jobs={jobs} vehicles={vehicles} />}
        {activeTab === 'notifications' && <NotificationsSection notifications={notifications} />}
        {activeTab === 'settings' && <SettingsSection profile={profile} />}
        
        <AnimatePresence>
          {showAddVehicle && (
            <AddVehicleModal 
              userId={profile.uid} 
              onClose={() => setShowAddVehicle(false)} 
            />
          )}
          {showNotifications && (
            <NotificationsModal 
              notifications={notifications} 
              onClose={() => setShowNotifications(false)} 
            />
          )}
          {selectedVehicleForDocs && (
            <VehicleDocumentsModal 
              vehicle={selectedVehicleForDocs} 
              onClose={() => setSelectedVehicleForDocs(null)} 
            />
          )}
          {selectedVehicleForHistory && (
            <VehicleHistoryModal 
              vehicle={selectedVehicleForHistory} 
              jobs={jobs.filter(j => j.vehicleId === selectedVehicleForHistory.id)}
              onClose={() => setSelectedVehicleForHistory(null)} 
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StatusSection({ appointments, jobs, vehicles }: { appointments: Appointment[], jobs: Job[], vehicles: Vehicle[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Service Tracking</h2>
      <div className="grid grid-cols-1 gap-4">
        {appointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(app => (
          <Card key={app.id} className="bg-card border-border">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-background border border-border">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{app.serviceType}</p>
                  <p className="text-sm text-muted-foreground">{new Date(app.date).toLocaleString()}</p>
                </div>
              </div>
              <Badge 
                className={cn(
                  "capitalize",
                  app.status === 'pending' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                  app.status === 'accepted' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                  'bg-muted text-muted-foreground'
                )}
                variant="outline"
              >
                {app.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {jobs.filter(j => vehicles.some(v => v.id === j.vehicleId)).map(job => (
          <Card key={job.id} className={cn(
            "bg-card border-border border-l-4",
            job.status === 'completed' ? "border-l-green-500" : 
            job.status === 'in-progress' ? "border-l-blue-500" : "border-l-red-500"
          )}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-background border border-border">
                  <Wrench className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">{job.tasks.join(', ')}</p>
                  <p className="text-sm text-muted-foreground">Vehicle: {vehicles.find(v => v.id === job.vehicleId)?.name}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge className={cn(
                  "capitalize mb-1",
                  job.status === 'completed' ? "bg-green-500/10 text-green-500" : 
                  job.status === 'in-progress' ? "bg-blue-500/10 text-blue-500" : 
                  job.status === 'pending' ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"
                )}>
                  {job.status}
                </Badge>
                <p className="text-[10px] text-muted-foreground">Updated: {new Date(job.updatedAt).toLocaleTimeString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NotificationsSection({ notifications }: { notifications: Notification[] }) {
  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.error('Failed to mark as read:', e);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      try {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      } catch (e) {
        console.error('Failed to mark as read:', e);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Notifications</h2>
        {notifications.some(n => !n.read) && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4">
        {notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((n) => (
          <Card key={n.id} className={cn("bg-card border-border transition-colors", !n.read && "border-primary/50 bg-primary/5")}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-xl", !n.read ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                  <Bell className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {!n.read && (
                <Button variant="ghost" size="sm" onClick={() => markAsRead(n.id)}>Mark as read</Button>
              )}
            </CardContent>
          </Card>
        ))}
        {notifications.length === 0 && (
          <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsSection({ profile }: { profile: UserProfile }) {
  const [formData, setFormData] = useState({
    name: profile.name,
    email: profile.email,
    phone: profile.phone || '',
  });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'users', profile.uid), formData);
      toast.success('Profile updated successfully');
    } catch (e) {
      toast.error('Failed to update profile');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={formData.email} 
                  disabled
                  className="pl-10 opacity-50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="pl-10"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
            <div className="pt-4">
              <Button type="submit" className="w-full">Update Profile</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Receive updates about your service</p>
            </div>
            <div className="w-12 h-6 bg-primary rounded-full relative">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InvoicesSection({ jobs, vehicles, profile }: { jobs: Job[], vehicles: Vehicle[], profile: UserProfile }) {
  const completedJobs = jobs
    .filter(j => j.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const downloadPDF = (job: Job) => {
    try {
      const vehicle = vehicles.find(v => v.id === job.vehicleId);
      const doc = new jsPDF() as any;
      
      doc.setFontSize(22);
      doc.setTextColor(40);
      doc.text('SERVICE INVOICE', 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Invoice ID: ${job.id?.toUpperCase()}`, 20, 35);
      doc.text(`Date: ${new Date(job.updatedAt).toLocaleDateString()}`, 20, 42);
      
      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text('CUSTOMER INFORMATION', 20, 60);
      doc.setFontSize(10);
      doc.text(`Name: ${profile.name}`, 20, 68);
      doc.text(`Email: ${profile.email}`, 20, 75);
      doc.text(`Phone: ${profile.phone || 'N/A'}`, 20, 82);
      
      doc.setFontSize(12);
      doc.text('VEHICLE INFORMATION', 120, 60);
      doc.setFontSize(10);
      doc.text(`Model: ${vehicle?.name || 'N/A'}`, 120, 68);
      doc.text(`Year: ${vehicle?.year || 'N/A'}`, 120, 75);
      doc.text(`Fuel Type: ${vehicle?.fuelType || 'N/A'}`, 120, 82);
      
      (doc as any).autoTable({
        startY: 100,
        head: [['Service Description', 'Amount']],
        body: [
          [job.tasks.join(', '), `$${job.cost}`],
          [{ content: 'Total Amount', styles: { fontStyle: 'bold' } }, { content: `$${job.cost}`, styles: { fontStyle: 'bold' } }]
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });
      
      doc.save(`Invoice_${job.id?.substring(0, 8)}.pdf`);
      toast.success('PDF Downloaded');
    } catch (err) {
      console.error('PDF Error:', err);
      toast.error('Failed to generate PDF');
    }
  };

  const downloadExcel = (job: Job) => {
    try {
      const vehicle = vehicles.find(v => v.id === job.vehicleId);
      const data = [
        ['SERVICE INVOICE'],
        [],
        ['Invoice ID', job.id],
        ['Date', new Date(job.updatedAt).toLocaleDateString()],
        [],
        ['CUSTOMER DETAILS'],
        ['Name', profile.name],
        ['Email', profile.email],
        [],
        ['VEHICLE DETAILS'],
        ['Model', vehicle?.name],
        ['Year', vehicle?.year],
        [],
        ['SERVICES'],
        ['Description', 'Cost'],
        [job.tasks.join(', '), job.cost],
        ['TOTAL', job.cost]
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
      XLSX.writeFile(wb, `Invoice_${job.id?.substring(0, 8)}.xlsx`);
      toast.success('Excel Downloaded');
    } catch (err) {
      console.error('Excel Error:', err);
      toast.error('Failed to generate Excel');
    }
  };

  const downloadCSV = (job: Job) => {
    try {
      const vehicle = vehicles.find(v => v.id === job.vehicleId);
      const rows = [
        ['Invoice ID', 'Date', 'Customer', 'Email', 'Vehicle', 'Tasks', 'Total Cost'],
        [job.id, new Date(job.updatedAt).toLocaleDateString(), profile.name, profile.email, vehicle?.name, job.tasks.join('; '), job.cost]
      ];
      const csvContent = rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Invoice_${job.id?.substring(0, 8)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV Downloaded');
    } catch (err) {
      console.error('CSV Error:', err);
      toast.error('Failed to generate CSV');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Invoices</h2>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {completedJobs.map((job) => {
          const vehicle = vehicles.find(v => v.id === job.vehicleId);
          return (
            <Card key={job.id} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                      <Receipt className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{vehicle?.name || 'Unknown Vehicle'}</h4>
                      <p className="text-sm text-muted-foreground">{job.tasks.join(', ')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(job.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <span className="text-xl font-bold text-primary">${job.cost}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => downloadPDF(job)} className="gap-2">
                        <Download className="h-3 w-3" /> PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => downloadExcel(job)} className="gap-2">
                        <FileSpreadsheet className="h-3 w-3" /> Excel
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => downloadCSV(job)} className="gap-2">
                        <FileJson className="h-3 w-3" /> CSV
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {completedJobs.length === 0 && (
          <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">No invoices generated yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function VehicleDocumentsModal({ vehicle, onClose }: { vehicle: Vehicle, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Documents</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">Documents for {vehicle.name}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Registration.pdf</span>
              </div>
              <Button variant="ghost" size="sm">View</Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Insurance_Policy.pdf</span>
              </div>
              <Button variant="ghost" size="sm">View</Button>
            </div>
          </div>
          <Button className="w-full mt-4" variant="outline">
            <Plus className="h-4 w-4 mr-2" /> Upload New Document
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function VehicleHistoryModal({ vehicle, jobs, onClose }: { vehicle: Vehicle, jobs: Job[], onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl bg-card border border-border rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Service History</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">Maintenance records for {vehicle.name}</p>
          {jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map(job => (
                <div key={job.id} className="p-4 rounded-2xl bg-muted/30 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">{job.tasks.join(', ')}</p>
                    <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>{job.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(job.updatedAt).toLocaleDateString()}</span>
                    </div>
                    {job.cost > 0 && <span className="font-mono text-foreground font-bold">${job.cost}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No service history found for this vehicle.</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function NotificationsModal({ notifications, onClose }: { notifications: Notification[], onClose: () => void }) {
  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.error('Failed to mark as read:', e);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      try {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      } catch (e) {
        console.error('Failed to mark as read:', e);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-end p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        className="w-full max-w-sm h-full bg-card border-l border-border shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold">Notifications</h2>
          <div className="flex items-center gap-2">
            {notifications.some(n => !n.read) && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-8">
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(n => (
            <div 
              key={n.id} 
              className={cn("p-4 rounded-xl border border-border cursor-pointer transition-colors", !n.read ? "bg-primary/5 border-primary/20" : "bg-muted/30")}
              onClick={() => markAsRead(n.id)}
            >
              <p className="text-sm">{n.message}</p>
              <p className="text-[10px] text-muted-foreground mt-2">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No new notifications</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function BookServiceSection({ vehicles, userId, onSuccess }: { vehicles: Vehicle[], userId: string, onSuccess: () => void }) {
  const [vehicleId, setVehicleId] = useState('');
  const [serviceType, setServiceType] = useState(SERVICE_CATEGORIES[0].services[0]);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const estimatedCost = SERVICE_PRICES[serviceType] || 0;

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return toast.error('Please select a vehicle');
    setLoading(true);
    try {
      await addDoc(collection(db, 'appointments'), {
        userId,
        vehicleId,
        serviceType,
        date: new Date(date).toISOString(),
        status: 'pending',
        notes,
        estimatedCost,
        createdAt: serverTimestamp()
      });

      // Notify admin (assuming admin has a specific role or we just create a general notification)
      // For now, we'll create a notification for all admins (role: 'admin')
      // This requires fetching admin UIDs, which might be complex here.
      // Alternatively, we just create a notification with a special flag.
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin', // Special marker for admin notifications
        message: `New appointment request for ${serviceType}.`,
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.success('Appointment requested!');
      onSuccess();
    } catch (e) {
      toast.error('Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Book a Service</CardTitle>
        <CardDescription>Schedule your next maintenance visit</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleBook} className="space-y-6">
          <div className="space-y-2">
            <Label>Select Vehicle</Label>
            <select 
              className="w-full h-10 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              required
            >
              <option value="">Choose a vehicle...</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <Label>Service Type</Label>
            <select 
              className="w-full h-10 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
            >
              {SERVICE_CATEGORIES.map((cat) => (
                <optgroup key={cat.name} label={`${cat.icon} ${cat.name}`}>
                  {cat.services.map((s) => (
                    <option key={s} value={s}>
                      {s} — ${SERVICE_PRICES[s]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Estimated Cost</span>
            </div>
            <span className="text-xl font-bold text-primary">${estimatedCost}</span>
          </div>

          <div className="space-y-2">
            <Label>Preferred Date</Label>
            <Input 
              type="datetime-local" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              required
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <textarea 
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm min-h-[100px] focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Any specific issues or requests?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 text-lg">
            {loading ? 'Booking...' : 'Confirm Appointment'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MyVehicles({ 
  vehicles, 
  onAdd, 
  onShowDocs, 
  onShowHistory 
}: { 
  vehicles: Vehicle[], 
  onAdd: () => void,
  onShowDocs: (v: Vehicle) => void,
  onShowHistory: (v: Vehicle) => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Vehicles</h2>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4 mr-2" /> Register Vehicle
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map((v) => (
          <Card key={v.id} className="bg-card border-border">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{v.name}</CardTitle>
                  <CardDescription>{v.year} • {v.fuelType}</CardDescription>
                </div>
                {v.urgency === 'High' && (
                  <Badge variant="destructive" className="animate-pulse">Urgent</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Odometer</span>
                  <span className="font-mono font-medium">{v.totalKm?.toLocaleString() || '---'} KM</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Service</span>
                  <span>{v.lastServiceDate || 'Never'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Next Predicted</span>
                  <span className={cn(
                    "font-bold",
                    v.nextServiceDate && new Date(v.nextServiceDate) < new Date() ? "text-red-500" : "text-foreground"
                  )}>
                    {v.nextServiceDate || 'TBD'}
                  </span>
                </div>
              </div>
              <div className="pt-4 flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 border-border"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowDocs(v);
                  }}
                >
                  Documents
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 border-border"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowHistory(v);
                  }}
                >
                  History
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AddVehicleModal({ userId, onClose }: { userId: string, onClose: () => void }) {
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [fuelType, setFuelType] = useState('Petrol');
  const [lastServiceDate, setLastServiceDate] = useState('');
  const [totalKm, setTotalKm] = useState('');
  const [avgDailyKm, setAvgDailyKm] = useState('30');
  const [serviceIntervalKm, setServiceIntervalKm] = useState('5000');
  const [serviceIntervalMonths, setServiceIntervalMonths] = useState('6');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const parsedYear = parseInt(year) || new Date().getFullYear();
    const parsedTotalKm = parseInt(totalKm) || 0;
    const parsedAvgDailyKm = parseInt(avgDailyKm) || 30;
    const parsedIntervalKm = parseInt(serviceIntervalKm) || 5000;
    const parsedIntervalMonths = parseInt(serviceIntervalMonths) || 6;

    try {
      const prediction = await predictNextService(
        name, 
        parsedYear, 
        fuelType, 
        lastServiceDate || undefined, 
        parsedTotalKm, 
        parsedAvgDailyKm, 
        parsedIntervalKm, 
        parsedIntervalMonths
      );
      
      const vehicleData = {
        ownerId: userId,
        name,
        year: parsedYear,
        fuelType,
        totalKm: parsedTotalKm,
        avgDailyKm: parsedAvgDailyKm,
        serviceIntervalKm: parsedIntervalKm,
        serviceIntervalMonths: parsedIntervalMonths,
        lastServiceDate: lastServiceDate || null,
        nextServiceDate: prediction.predictedDate,
        urgency: prediction.urgency,
        documents: []
      };

      try {
        await addDoc(collection(db, 'vehicles'), vehicleData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'vehicles');
      }

      toast.success('Vehicle registered with intelligent prediction!');
      onClose();
    } catch (e) {
      console.error('Registration error:', e);
      toast.error('Failed to register vehicle. Please check your data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg bg-card border border-border rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <h2 className="text-2xl font-bold mb-6">Register New Vehicle</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vehicle Name / Model</Label>
              <Input 
                placeholder="e.g. Tesla Model 3" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required
                className="bg-background border-border"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year of Purchase</Label>
                <Input 
                  type="number" 
                  placeholder="2024" 
                  value={year} 
                  onChange={(e) => setYear(e.target.value)} 
                  required
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Fuel Type</Label>
                <select 
                  className="w-full h-10 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as any)}
                >
                  <option>Petrol</option>
                  <option>Diesel</option>
                  <option>Electric</option>
                  <option>Hybrid</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Last Service Date (Optional)</Label>
              <Input 
                type="date" 
                value={lastServiceDate} 
                onChange={(e) => setLastServiceDate(e.target.value)} 
                className="bg-background border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Kilometers Driven</Label>
                <Input 
                  type="number" 
                  placeholder="e.g. 15000" 
                  value={totalKm} 
                  onChange={(e) => setTotalKm(e.target.value)} 
                  required
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Avg. Daily Usage (KM)</Label>
                <Input 
                  type="number" 
                  placeholder="e.g. 30" 
                  value={avgDailyKm} 
                  onChange={(e) => setAvgDailyKm(e.target.value)} 
                  required
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service Interval (KM)</Label>
                <Input 
                  type="number" 
                  placeholder="e.g. 5000" 
                  value={serviceIntervalKm} 
                  onChange={(e) => setServiceIntervalKm(e.target.value)} 
                  required
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Service Interval (Months)</Label>
                <Input 
                  type="number" 
                  placeholder="e.g. 6" 
                  value={serviceIntervalMonths} 
                  onChange={(e) => setServiceIntervalMonths(e.target.value)} 
                  required
                  className="bg-background border-border"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Registering...' : 'Register'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
