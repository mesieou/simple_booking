'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/database/supabase/client';

type NotificationData = {
  id: string;
  businessId: string;
  chatSessionId: string;
  status: string;
  message: string;
  createdAt: string;
};

type ChatSessionData = {
  id: string;
  channelUserId: string;
  businessId: string;
  updatedAt: string;
};

type ConversationData = {
  channelUserId: string;
  updatedAt: string;
  hasEscalation: boolean;
  escalationStatus: string | null;
  sessionId: string;
};

type RLSTestResults = {
  userBusinessId: string;
  tests: {
    serviceRole?: { success: boolean; error?: string; count: number; data: any[] };
    regularClient?: { success: boolean; error?: string; count: number; data: any[] };
    totalCount?: { success: boolean; error?: string; totalNotifications: number };
    activeNotifications?: { success: boolean; error?: string; count: number; data: any[] };
    chatSessions?: { success: boolean; error?: string; count: number; data: any[] };
  };
  summary: string;
};

export default function DebugEscalationsPage() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [activeNotifications, setActiveNotifications] = useState<NotificationData[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSessionData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingTestEscalation, setIsCreatingTestEscalation] = useState(false);
  const [rlsTestResults, setRlsTestResults] = useState<RLSTestResults | null>(null);
  const [isTestingRLS, setIsTestingRLS] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get current user's business conversations using the action
      const { getBusinessConversations } = await import('@/app/actions');
      const conversationsData = await getBusinessConversations();
      setConversations(conversationsData);
      
      setLoading(false);
    } catch (err) {
      console.error('Debug error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const testRLSAccess = async () => {
    setIsTestingRLS(true);
    setRlsTestResults(null);
    
    try {
      const response = await fetch('/api/debug/test-notifications-rls');
      
      if (response.ok) {
        const results = await response.json();
        setRlsTestResults(results);
      } else {
        const errorData = await response.json();
        setError('Error testing RLS: ' + errorData.error);
      }
    } catch (error) {
      console.error('Error testing RLS:', error);
      setError('Error testing RLS: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsTestingRLS(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createTestEscalation = async () => {
    if (conversations.length === 0) {
      alert('No hay conversaciones disponibles para crear una escalación de prueba');
      return;
    }

    const targetConversation = conversations[0]; // Use the first conversation
    
    setIsCreatingTestEscalation(true);
    
    try {
      // Create a test notification via API
      const response = await fetch('/api/debug/create-test-escalation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: targetConversation.sessionId,
          channelUserId: targetConversation.channelUserId,
        }),
      });

      if (response.ok) {
        alert('✅ Escalación de prueba creada! Recargaremos los datos...');
        await loadData(); // Reload data
      } else {
        const errorData = await response.json();
        alert('❌ Error creando escalación de prueba: ' + errorData.error);
      }
    } catch (error) {
      console.error('Error creating test escalation:', error);
      alert('❌ Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsCreatingTestEscalation(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">🔍 Debug Escalaciones</h1>
        <div className="bg-gray-100 p-4 rounded">
          <p>Cargando datos de debug...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">🔍 Debug Escalaciones</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">🔍 Debug Escalaciones</h1>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            🔄 Recargar Datos
          </button>
          <button
            onClick={testRLSAccess}
            disabled={isTestingRLS}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {isTestingRLS ? '⏳ Probando...' : '🔐 Probar Acceso RLS'}
          </button>
          {conversations.length > 0 && (
            <button
              onClick={createTestEscalation}
              disabled={isCreatingTestEscalation}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {isCreatingTestEscalation ? '⏳ Creando...' : '🧪 Crear Escalación de Prueba'}
            </button>
          )}
        </div>
      </div>

      {/* RLS Test Results */}
      {rlsTestResults && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">🔐 Resultados de Prueba RLS</h2>
          
          <div className={`p-4 rounded border-l-4 ${
            rlsTestResults.summary.includes('✅') ? 'border-green-500 bg-green-50' :
            rlsTestResults.summary.includes('❌') ? 'border-red-500 bg-red-50' :
            'border-yellow-500 bg-yellow-50'
          }`}>
            <p className="font-medium mb-2">Resumen:</p>
            <p className="text-sm">{rlsTestResults.summary}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(rlsTestResults.tests).map(([testName, result]) => (
              <div key={testName} className="bg-white p-3 rounded border">
                <h3 className="font-medium text-sm mb-2 capitalize">{testName.replace(/([A-Z])/g, ' $1')}</h3>
                <div className="space-y-1 text-xs">
                  <p className={result.success ? 'text-green-600' : 'text-red-600'}>
                    {result.success ? '✅ Éxito' : '❌ Error'}
                  </p>
                  {result.error && <p className="text-red-500">Error: {result.error}</p>}
                  {'count' in result && typeof result.count !== 'undefined' && <p>Registros: {result.count}</p>}
                  {'totalNotifications' in result && typeof result.totalNotifications !== 'undefined' && 
                    <p>Total en tabla: {result.totalNotifications}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Conversations from getBusinessConversations */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          💬 Conversaciones (desde getBusinessConversations)
          <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
            {conversations.length}
          </span>
        </h2>
        
        {conversations.length === 0 ? (
          <div className="bg-gray-100 p-4 rounded">
            <p>No se encontraron conversaciones</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {conversations.map((conv, index) => (
              <div
                key={conv.sessionId}
                className={`p-4 rounded border-l-4 ${
                  conv.hasEscalation
                    ? conv.escalationStatus === 'pending'
                      ? 'border-yellow-500 bg-yellow-50'
                      : conv.escalationStatus === 'attending'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-500 bg-gray-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{conv.channelUserId}</h3>
                  <div className="flex items-center gap-2">
                    {conv.hasEscalation && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        conv.escalationStatus === 'pending'
                          ? 'bg-yellow-200 text-yellow-800'
                          : conv.escalationStatus === 'attending'
                          ? 'bg-green-200 text-green-800'
                          : 'bg-gray-200 text-gray-800'
                      }`}>
                        {conv.escalationStatus === 'pending' && '⚠️ Pending'}
                        {conv.escalationStatus === 'attending' && '✅ Attending'}
                        {conv.escalationStatus && conv.escalationStatus !== 'pending' && conv.escalationStatus !== 'attending' && conv.escalationStatus}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Session ID:</strong> {conv.sessionId}</p>
                  <p><strong>Has Escalation:</strong> {conv.hasEscalation ? '✅ Sí' : '❌ No'}</p>
                  <p><strong>Escalation Status:</strong> {conv.escalationStatus || 'N/A'}</p>
                  <p><strong>Updated:</strong> {new Date(conv.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded">
        <h3 className="font-semibold mb-2">📊 Resumen</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="font-medium">Total Conversaciones</p>
            <p className="text-lg">{conversations.length}</p>
          </div>
          <div>
            <p className="font-medium">Con Escalación</p>
            <p className="text-lg">{conversations.filter(c => c.hasEscalation).length}</p>
          </div>
          <div>
            <p className="font-medium">Pending</p>
            <p className="text-lg">{conversations.filter(c => c.escalationStatus === 'pending').length}</p>
          </div>
          <div>
            <p className="font-medium">Attending</p>
            <p className="text-lg">{conversations.filter(c => c.escalationStatus === 'attending').length}</p>
          </div>
        </div>
      </div>

      {/* Diagnóstico */}
      <div className="mt-8 bg-gray-50 p-4 rounded">
        <h3 className="font-semibold mb-2">🩺 Diagnóstico</h3>
        <div className="space-y-2 text-sm">
          {conversations.filter(c => c.hasEscalation).length === 0 && (
            <p className="text-orange-600">⚠️ No hay conversaciones con escalación activa. Esto podría explicar por qué no ves los highlights.</p>
          )}
          
          {conversations.filter(c => c.hasEscalation).length > 0 && (
            <p className="text-green-600">✅ Se encontraron {conversations.filter(c => c.hasEscalation).length} conversaciones con escalación. Los highlights deberían estar visibles.</p>
          )}

          <p className="text-gray-600">
            💡 Si hay escalaciones pero no ves los highlights, el problema podría estar en el componente ChatList o en la actualización en tiempo real.
          </p>
          
          <p className="text-blue-600">
            🧪 Puedes usar el botón "Crear Escalación de Prueba" para generar una escalación y verificar si aparece en el dashboard.
          </p>

          <p className="text-purple-600">
            🔐 Usa el botón "Probar Acceso RLS" para verificar si hay problemas de permisos en la base de datos.
          </p>
        </div>
      </div>
    </div>
  );
} 