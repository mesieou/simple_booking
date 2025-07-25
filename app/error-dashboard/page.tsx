'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, TrendingUp, CheckCircle, Clock, RefreshCw } from 'lucide-react';

interface ErrorLog {
  id: string;
  errorLevel: 'error' | 'warn' | 'critical';
  errorType: string;
  errorMessage: string;
  url?: string;
  method?: string;
  resolved: boolean;
  createdAt: string;
  userAgent?: string;
  additionalContext?: any;
}

interface ErrorStats {
  total: number;
  critical: number;
  error: number;
  warn: number;
  resolved: number;
  unresolved: number;
  last24Hours: number;
}

const getLevelColor = (level: string) => {
  switch (level) {
    case 'critical': return 'bg-red-500 text-white';
    case 'error': return 'bg-orange-500 text-white';
    case 'warn': return 'bg-yellow-500 text-black';
    default: return 'bg-gray-500 text-white';
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

export default function ErrorDashboard() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [resolvedFilter, setResolvedFilter] = useState<string>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      if (levelFilter !== 'all') params.append('level', levelFilter);
      if (resolvedFilter !== 'all') params.append('resolved', resolvedFilter);

      // Fetch errors and stats in parallel
      const [errorsResponse, statsResponse] = await Promise.all([
        fetch(`/api/errors?${params.toString()}`),
        fetch('/api/errors/stats')
      ]);

      if (!errorsResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const errorsData = await errorsResponse.json();
      const statsData = await statsResponse.json();

      setErrors(errorsData.errors || []);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [levelFilter, resolvedFilter]);

  const markAsResolved = async (errorId: string) => {
    // Note: You would implement this API endpoint
    console.log('Mark as resolved:', errorId);
    // For now, just refresh the data
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading error data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load error dashboard: {error}
          <Button 
            onClick={fetchData} 
            variant="outline" 
            size="sm" 
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Error Dashboard</h1>
          <p className="text-gray-600">Monitor and track production errors</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.last24Hours} in last 24h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
              <p className="text-xs text-muted-foreground">Needs immediate attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.unresolved}</div>
              <p className="text-xs text-muted-foreground">Pending resolution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}% resolution rate
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
          </SelectContent>
        </Select>

        <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="false">Unresolved</SelectItem>
            <SelectItem value="true">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
          <CardDescription>
            {errors.length} error{errors.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No errors found. This is good news! 🎉
            </div>
          ) : (
            <div className="space-y-4">
              {errors.map((error) => (
                <div key={error.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getLevelColor(error.errorLevel)}>
                          {error.errorLevel.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{error.errorType}</Badge>
                        {error.resolved && (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className="font-medium mb-1">{error.errorMessage}</h3>
                      
                      <div className="text-sm text-gray-500 space-y-1">
                        <div>Time: {formatDate(error.createdAt)}</div>
                        {error.url && <div>URL: {error.url}</div>}
                        {error.method && <div>Method: {error.method}</div>}
                      </div>

                      {error.additionalContext && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                            Additional Context
                          </summary>
                          <pre className="mt-1 p-2 bg-gray-50 border rounded text-xs overflow-auto">
                            {JSON.stringify(error.additionalContext, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>

                    {!error.resolved && (
                      <Button
                        onClick={() => markAsResolved(error.id)}
                        size="sm"
                        variant="outline"
                      >
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 