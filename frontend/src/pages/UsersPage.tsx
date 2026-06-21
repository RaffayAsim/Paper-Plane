import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Edit, LogIn, RefreshCw, Search, Shield, Trash2, UserCheck, UserX, Users, CheckCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserEntry {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  subscriptionPlan: "base" | "ai_lead_gen";
  isActive: boolean;
  createdAt: string;
  impersonatedBy?: {
    userId: string;
    email: string;
    displayName: string;
  } | null;
  hasProfile?: boolean;
  setupStatus?: "none" | "pending" | "approved";
  onboardedAt?: string | null;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  base: { label: "Base", color: "bg-muted/60 text-muted-foreground border-border" },
  ai_lead_gen: { label: "AI Lead Gen", color: "bg-primary/10 text-primary border-primary/20" },
};

export default function UsersPage({ isEmbedded }: { isEmbedded?: boolean }) {
  const { toast } = useToast();
  const { user: currentUser, startImpersonation } = useAuth();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserEntry | null>(null);
  const [editForm, setEditForm] = useState({ displayName: "", email: "" });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: UserEntry[] }>("/admin/users");
      setUsers(data.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load users";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;

    return users.filter((user) => {
      return (
        user.displayName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        (user.roles[0] || "").toLowerCase().includes(term) ||
        user.subscriptionPlan.toLowerCase().includes(term)
      );
    });
  }, [search, users]);

  const updateRole = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, roles: newRole === "none" ? [] : [newRole] } : user)),
      );
      toast({ title: "Role updated", description: `User role changed to ${ROLE_LABELS[newRole]?.label || newRole}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update role";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const updateStatus = async (userId: string, isActive: boolean) => {
    setUpdatingId(userId);
    try {
      await api.patch(`/admin/users/${userId}/status`, { isActive });
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, isActive } : user)));
      toast({ title: isActive ? "Account enabled" : "Account disabled" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update account";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const updateSubscriptionPlan = async (userId: string, subscriptionPlan: UserEntry["subscriptionPlan"]) => {
    setUpdatingId(userId);
    try {
      await api.patch(`/admin/users/${userId}/subscription`, { subscriptionPlan });
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, subscriptionPlan } : user)));
      toast({ title: "Subscription updated", description: `User plan changed to ${PLAN_LABELS[subscriptionPlan].label}.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update subscription";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const openEditDialog = (user: UserEntry) => {
    setEditingUser(user);
    setEditForm({
      displayName: user.displayName,
      email: user.email,
    });
  };

  const saveProfile = async () => {
    if (!editingUser) return;

    setUpdatingId(editingUser.id);
    try {
      const response = await api.patch<{ item: { id: string; displayName: string; email: string; isActive: boolean } }>(
        `/admin/users/${editingUser.id}`,
        editForm,
      );

      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                displayName: response.item.displayName,
                email: response.item.email,
                isActive: response.item.isActive,
              }
            : user,
        ),
      );
      setEditingUser(null);
      toast({ title: "Profile updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    setUpdatingId(userId);
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      toast({ title: "User deleted", description: `${email} has been removed` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const impersonateUser = async (userId: string) => {
    setUpdatingId(userId);
    try {
      const session = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: UserEntry;
      }>(`/admin/users/${userId}/impersonate`);

      startImpersonation(session);
      toast({ title: "Impersonation started", description: `You are now signed in as ${session.user.email}.` });
      window.location.href = "/dashboard";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign in as user";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const approveProfile = async (userId: string) => {
    setUpdatingId(userId);
    try {
      await api.patch(`/admin/users/${userId}/approve-profile`);
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, setupStatus: "approved" } : user)),
      );
      toast({ title: "Profile approved successfully!" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve profile";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const content = (
    <div className="space-y-6">
      {!isEmbedded && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
              <Users className="h-6 w-6" /> User Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Loading..." : `${filteredUsers.length} of ${users.length} users shown`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchUsers()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-4"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, role, or plan..."
              className="pl-10"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card overflow-hidden rounded-xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-border bg-background">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subscription Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Profile Setup</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Admin Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Change Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Change Admin Role</th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Joined</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Loading users...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No users found</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const currentRole = user.roles[0] || "";
                    const roleInfo = currentRole ? ROLE_LABELS[currentRole] : null;
                    const planInfo = PLAN_LABELS[user.subscriptionPlan] || PLAN_LABELS.base;

                    return (
                      <tr key={user.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            {currentRole === "super_admin" && <Shield className="h-4 w-4 text-destructive" />}
                            {user.displayName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={user.isActive ? "secondary" : "outline"}>
                            {user.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={planInfo.color}>
                            {planInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {user.subscriptionPlan === "base" ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : user.setupStatus === "approved" ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              Approved
                            </Badge>
                          ) : user.setupStatus === "pending" ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse">
                              Pending Setup
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20">
                              Unconfigured
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {roleInfo ? (
                            <Badge variant="outline" className={roleInfo.color}>
                              {roleInfo.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {currentRole === "super_admin" ? (
                            <span className="text-muted-foreground">Admin only</span>
                          ) : (
                            <Select
                              value={user.subscriptionPlan}
                              onValueChange={(value) => void updateSubscriptionPlan(user.id, value as UserEntry["subscriptionPlan"])}
                              disabled={updatingId === user.id}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="base">Base</SelectItem>
                                <SelectItem value="ai_lead_gen">AI Lead Gen</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={currentRole || "none"}
                            onValueChange={(value) => void updateRole(user.id, value)}
                            disabled={updatingId === user.id}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                             <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(user)}
                              disabled={updatingId === user.id}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            {user.setupStatus === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void approveProfile(user.id)}
                                disabled={updatingId === user.id}
                                title="Approve Company Profile Setup"
                                className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}

                            {currentUser?.id !== user.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void impersonateUser(user.id)}
                                disabled={updatingId === user.id}
                                title="Sign in as user"
                                className="text-primary hover:text-primary"
                              >
                                <LogIn className="h-4 w-4" />
                              </Button>
                            )}

                            {currentRole !== "super_admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void updateStatus(user.id, !user.isActive)}
                                disabled={updatingId === user.id}
                                className={user.isActive ? "text-amber-600 hover:text-amber-600" : "text-emerald-600 hover:text-emerald-600"}
                              >
                                {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </Button>
                            )}

                            {currentRole !== "super_admin" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    disabled={updatingId === user.id}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete <strong>{user.email}</strong>? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => void deleteUser(user.id, user.email)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update the selected user's profile details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, displayName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button onClick={() => void saveProfile()} disabled={!editingUser || updatingId === editingUser.id}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );

  if (isEmbedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
