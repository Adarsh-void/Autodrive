import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebase';
import { collection, query, onSnapshot, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { UserProfile, Vehicle, Appointment, Job, InventoryItem, Notification } from '../../types';
import Sidebar from '../../components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../lib/utils';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../components/ui/table';
import { 
  Users, 
  Car, 
  Wrench, 
  DollarSign, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreVertical,
  Search,
  Bell,
  Calendar,
  Plus,
  X,
  Edit2
} from 'lucide-react';
import { addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cell,
  ResponsiveContainer,
  Pie,
  PieChart,
  Line,
  LineChart,
  Tooltip,
  CartesianGrid,
  YAxis,
  XAxis,
  Bar,
  BarChart,
  Legend
} from 'recharts';
import { SERVICE_PRICES } from '../../constants/services';
import { toast } from 'sonner';
import { User, Mail, Shield, Smartphone } from 'lucide-react';
import { predictNextService } from '../../services/geminiService';

interface AdminDashboardProps {
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

export default function AdminDashboard({ profile, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPart, setShowAddPart] = useState(false);
  const [editingPart, setEditingPart] = useState<InventoryItem | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
    }, (error) => console.error("Error fetching users:", error));
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setVehicles(snap.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle)));
    }, (error) => console.error("Error fetching vehicles:", error));
    const unsubAppointments = onSnapshot(collection(db, 'appointments'), (snap) => {
      setAppointments(snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment)));
    }, (error) => console.error("Error fetching appointments:", error));
    const unsubJobs = onSnapshot(collection(db, 'jobs'), (snap) => {
      setJobs(snap.docs.map(d => ({ ...d.data(), id: d.id } as Job)));
    }, (error) => console.error("Error fetching jobs:", error));
    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snap) => {
      setInventory(snap.docs.map(d => ({ ...d.data(), id: d.id } as InventoryItem)));
    }, (error) => console.error("Error fetching inventory:", error));
    const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snap) => {
      // For admin, we show notifications where userId is 'admin'
      setNotifications(snap.docs
        .map(d => ({ ...d.data(), id: d.id } as Notification))
        .filter(n => n.userId === 'admin')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    }, (error) => console.error("Error fetching notifications:", error));

    return () => {
      unsubUsers();
      unsubVehicles();
      unsubAppointments();
      unsubJobs();
      unsubInventory();
      unsubNotifications();
    };
  }, []);

  useEffect(() => {
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const dailyRevenue: Record<string, number> = {};
    
    completedJobs.forEach(job => {
      const date = new Date(job.updatedAt).toISOString().split('T')[0];
      dailyRevenue[date] = (dailyRevenue[date] || 0) + job.cost;
    });
    
    const sortedData = Object.entries(dailyRevenue)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
      
    setRevenueData(sortedData);
  }, [jobs]);

  const handleLogout = async () => {
    await auth.signOut();
    onLogout();
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    if (!userId) {
      toast.error('Invalid user ID');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: currentStatus === 'active' ? 'blocked' : 'active'
      });
      toast.success('User status updated');
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const serviceDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach(app => {
      const type = app.serviceType.split(' ')[0];
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [appointments]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={users.length} icon={Users} color="text-blue-400" />
        <StatCard title="Active Jobs" value={jobs.filter(j => j.status !== 'completed').length} icon={Wrench} color="text-orange-400" />
        <StatCard title="Vehicles" value={vehicles.length} icon={Car} color="text-purple-400" />
        <StatCard title="Low Stock" value={inventory.filter(i => i.stock <= i.minStockAlert).length} icon={AlertTriangle} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="#ffffff" fontSize={12} />
                <YAxis stroke="#ffffff" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Bar dataKey="amount" fill="#ffffff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Service Mix</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceDistribution.length > 0 ? serviceDistribution : [{ name: 'None', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {serviceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {appointments
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((app) => (
                <div key={app.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{app.serviceType}</p>
                      <p className="text-xs text-muted-foreground">{new Date(app.date).toLocaleDateString()}</p>
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inventory.filter(i => i.stock <= i.minStockAlert).slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">{item.partName}</p>
                      <p className="text-xs text-red-500/70">{item.stock} units left</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActiveTab('inventory')}>Restock</Button>
                </div>
              ))}
              {inventory.filter(i => i.stock <= i.minStockAlert).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20 text-green-500" />
                  <p className="text-sm">All stock levels healthy</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUsers = () => (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>User Management</CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            type="text" 
            placeholder="Search users..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-64 bg-background border-border"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Email</TableHead>
              <TableHead className="text-muted-foreground">Role</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((u) => (
              <TableRow key={u.uid} className="border-border hover:bg-muted/50">
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">{u.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={u.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}>
                    {u.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => toggleUserStatus(u.uid, u.status)}
                    className={u.status === 'active' ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}
                  >
                    {u.status === 'active' ? 'Block' : 'Unblock'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        role="admin" 
        onLogout={handleLogout} 
        badges={{
          appointments: appointments.filter(a => a.status === 'pending').length,
          notifications: notifications.filter(n => !n.read).length,
          inventory: inventory.filter(i => i.stock <= i.minStockAlert).length
        }}
      />
      
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
            <p className="text-muted-foreground">Welcome back, {profile.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              className="border-border bg-card relative"
              onClick={() => setShowNotifications(true)}
            >
              <Bell className="h-4 w-4" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-[10px] font-bold text-primary-foreground rounded-full flex items-center justify-center">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <div className="text-right">
                <p className="text-sm font-medium">{profile.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                {profile.name[0]}
              </div>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'vehicles' && <VehiclesSection vehicles={vehicles} users={users} />}
        {activeTab === 'inventory' && <InventorySection inventory={inventory} onAdd={() => setShowAddPart(true)} onEdit={setEditingPart} />}
        {activeTab === 'appointments' && <AppointmentsSection appointments={appointments} />}
        {activeTab === 'jobs' && <JobsSection jobs={jobs} vehicles={vehicles} />}
        {activeTab === 'reports' && <ReportsSection revenueData={revenueData} appointments={appointments} />}
        {activeTab === 'notifications' && <NotificationsSection notifications={notifications} />}
        {activeTab === 'settings' && <SettingsSection profile={profile} />}

        <AnimatePresence>
          {showAddPart && (
            <AddPartModal onClose={() => setShowAddPart(false)} />
          )}
          {editingPart && (
            <EditPartModal part={editingPart} onClose={() => setEditingPart(null)} />
          )}
          {showNotifications && (
            <NotificationsModal notifications={notifications} onClose={() => setShowNotifications(false)} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function VehiclesSection({ vehicles, users }: { vehicles: Vehicle[], users: UserProfile[] }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>All Registered Vehicles</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Vehicle Name</TableHead>
              <TableHead className="text-muted-foreground">Owner</TableHead>
              <TableHead className="text-muted-foreground">Year</TableHead>
              <TableHead className="text-muted-foreground">Fuel Type</TableHead>
              <TableHead className="text-muted-foreground">Last Service</TableHead>
              <TableHead className="text-muted-foreground">Next Service</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((v) => {
              const owner = users.find(u => u.uid === v.ownerId);
              return (
                <TableRow key={v.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{owner?.name || 'Unknown'}</TableCell>
                  <TableCell>{v.year}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{v.fuelType}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.lastServiceDate || 'N/A'}</TableCell>
                  <TableCell className="text-muted-foreground">{v.nextServiceDate || 'N/A'}</TableCell>
                </TableRow>
              );
            })}
            {vehicles.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No vehicles registered in the system.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AppointmentsSection({ appointments }: { appointments: Appointment[] }) {
  const handleAction = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      try {
        await updateDoc(doc(db, 'appointments', id), { status });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
      }

      const app = appointments.find(a => a.id === id);
      if (app) {
        // Create notification for user
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: app.userId,
            message: `Your appointment for ${app.serviceType} has been ${status}.`,
            read: false,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          console.error('Failed to create notification:', err);
        }

        if (status === 'accepted') {
          try {
            await addDoc(collection(db, 'jobs'), {
              appointmentId: id,
              vehicleId: app.vehicleId,
              userId: app.userId,
              status: 'pending',
              tasks: [app.serviceType],
              cost: (app as any).estimatedCost || SERVICE_PRICES[app.serviceType] || 0,
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'jobs');
          }
        }
      }
      toast.success(`Appointment ${status}`);
    } catch (e) {
      console.error('Action failed:', e);
      toast.error('Action failed');
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Service Appointments</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead className="text-muted-foreground">Service</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((app) => (
              <TableRow key={app.id} className="border-border">
                <TableCell>{new Date(app.date).toLocaleString()}</TableCell>
                <TableCell>{app.serviceType}</TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {app.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => handleAction(app.id, 'accepted')} className="bg-green-600 hover:bg-green-500 text-white">Accept</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleAction(app.id, 'rejected')}>Reject</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function JobsSection({ jobs, vehicles }: { jobs: Job[], vehicles: Vehicle[] }) {
  const updateJobStatus = async (id: string, status: string) => {
    try {
      try {
        await updateDoc(doc(db, 'jobs', id), { status, updatedAt: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `jobs/${id}`);
      }
      
      const job = jobs.find(j => j.id === id);
      const vehicle = vehicles.find(v => v.id === job?.vehicleId);

      if (job) {
        // Create notification for user
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: job.userId,
            message: `The status of your service job for ${vehicle?.name || 'your vehicle'} has been updated to ${status}.`,
            read: false,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          console.error('Failed to create notification:', err);
        }

        if (status === 'completed' && vehicle) {
          const lastServiceDate = new Date().toISOString().split('T')[0];
          const prediction = await predictNextService(
            vehicle.name, 
            vehicle.year, 
            vehicle.fuelType, 
            lastServiceDate,
            vehicle.totalKm,
            vehicle.avgDailyKm,
            vehicle.serviceIntervalKm,
            vehicle.serviceIntervalMonths
          );
          try {
            await updateDoc(doc(db, 'vehicles', vehicle.id), {
              lastServiceDate,
              nextServiceDate: prediction.predictedDate,
              urgency: prediction.urgency
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `vehicles/${vehicle.id}`);
          }
          toast.success('Vehicle service dates updated via AI prediction');
        }
      }
      
      toast.success('Job status updated');
    } catch (e) {
      console.error('Update status failed:', e);
      toast.error('Failed to update status');
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Active Service Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground">Vehicle</TableHead>
              <TableHead className="text-muted-foreground">Tasks</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((job) => {
              const vehicle = vehicles.find(v => v.id === job.vehicleId);
              return (
                <TableRow key={job.id} className="border-border">
                  <TableCell className="font-medium">{vehicle?.name || 'Unknown'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{job.tasks.join(', ')}</TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "capitalize",
                      job.status === 'completed' ? 'bg-green-500/10 text-green-500' : 
                      job.status === 'in-progress' ? 'bg-blue-500/10 text-blue-500' : 
                      job.status === 'pending' ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'
                    )}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <select 
                      className="h-8 px-2 bg-background border border-border rounded text-xs focus:ring-1 focus:ring-primary"
                      value={job.status}
                      onChange={(e) => updateJobStatus(job.id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AddPartModal({ onClose }: { onClose: () => void }) {
  const [partName, setPartName] = useState('');
  const [stock, setStock] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'inventory'), {
        partName,
        stock: parseInt(stock),
        minStockAlert: parseInt(minStockAlert),
        price: parseFloat(price)
      });
      toast.success('Part added to inventory');
      onClose();
    } catch (e) {
      toast.error('Failed to add part');
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
        className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Add Inventory Part</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Part Name</Label>
            <Input 
              placeholder="e.g. Brake Pads" 
              value={partName} 
              onChange={(e) => setPartName(e.target.value)} 
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Initial Stock</Label>
              <Input 
                type="number" 
                placeholder="10" 
                value={stock} 
                onChange={(e) => setStock(e.target.value)} 
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Alert Level</Label>
              <Input 
                type="number" 
                placeholder="2" 
                value={minStockAlert} 
                onChange={(e) => setMinStockAlert(e.target.value)} 
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Price ($)</Label>
            <Input 
              type="number" 
              step="0.01"
              placeholder="49.99" 
              value={price} 
              onChange={(e) => setPrice(e.target.value)} 
              required
            />
          </div>
          <div className="pt-6 flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Adding...' : 'Add Part'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-bold mt-1">{value}</h3>
          </div>
          <div className={cn("p-3 rounded-xl bg-background border border-border", color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InventorySection({ inventory, onAdd, onEdit }: { inventory: InventoryItem[], onAdd: () => void, onEdit: (item: InventoryItem) => void }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Inventory Management</CardTitle>
        <Button onClick={onAdd} className="bg-primary text-primary-foreground hover:bg-primary/90">Add Part</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Part Name</TableHead>
              <TableHead className="text-muted-foreground">Stock</TableHead>
              <TableHead className="text-muted-foreground">Price</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map((item) => (
              <TableRow key={item.id} className="border-border hover:bg-muted/50">
                <TableCell className="font-medium">{item.partName}</TableCell>
                <TableCell>{item.stock} units</TableCell>
                <TableCell>${item.price}</TableCell>
                <TableCell>
                  {item.stock <= item.minStockAlert ? (
                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Low Stock</Badge>
                  ) : (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">In Stock</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {inventory.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No inventory items found. Add your first part to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EditPartModal({ part, onClose }: { part: InventoryItem, onClose: () => void }) {
  const [partName, setPartName] = useState(part.partName);
  const [stock, setStock] = useState(part.stock.toString());
  const [minStockAlert, setMinStockAlert] = useState(part.minStockAlert.toString());
  const [price, setPrice] = useState(part.price.toString());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'inventory', part.id), {
        partName,
        stock: parseInt(stock),
        minStockAlert: parseInt(minStockAlert),
        price: parseFloat(price)
      });
      toast.success('Part updated successfully');
      onClose();
    } catch (e) {
      toast.error('Failed to update part');
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
        className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Edit Part</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Part Name</Label>
            <Input 
              value={partName} 
              onChange={(e) => setPartName(e.target.value)} 
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stock</Label>
              <Input 
                type="number" 
                value={stock} 
                onChange={(e) => setStock(e.target.value)} 
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Alert Level</Label>
              <Input 
                type="number" 
                value={minStockAlert} 
                onChange={(e) => setMinStockAlert(e.target.value)} 
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Price ($)</Label>
            <Input 
              type="number" 
              step="0.01"
              value={price} 
              onChange={(e) => setPrice(e.target.value)} 
              required
            />
          </div>
          <div className="pt-6 flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Updating...' : 'Update Part'}
            </Button>
          </div>
        </form>
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
          <h2 className="text-xl font-bold">Admin Notifications</h2>
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
          {notifications.map(n => (
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
        <h2 className="text-2xl font-bold">System Notifications</h2>
        {notifications.some(n => !n.read) && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4">
        {notifications.map((n) => (
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
          <CardTitle>Admin Settings</CardTitle>
          <CardDescription>Manage your profile and account preferences</CardDescription>
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
              <Button type="submit" className="w-full">Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div>
              <p className="font-medium">Administrator Access</p>
              <p className="text-sm text-muted-foreground">Full system permissions enabled</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">Verified</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsSection({ revenueData, appointments }: { revenueData: any[], appointments: Appointment[] }) {
  const serviceDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach(app => {
      const type = app.serviceType.split(' ')[0]; // Simplify name
      counts[type] = (counts[type] || 0) + 1;
    });
    
    if (Object.keys(counts).length === 0) {
      return [
        { name: 'General', value: 1 },
        { name: 'Oil', value: 1 },
        { name: 'Brakes', value: 1 },
      ];
    }
    
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [appointments]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle>Revenue Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="#ffffff" />
                <YAxis stroke="#ffffff" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Line type="monotone" dataKey="amount" stroke="#ffffff" strokeWidth={3} dot={{ fill: '#ffffff', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Service Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {serviceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {serviceDistribution.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Daily Revenue Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((d, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell>{d.date}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-white">${d.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Removed redundant cn function
