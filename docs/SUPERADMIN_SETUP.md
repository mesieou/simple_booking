# Superadmin Setup Guide

## Overview

El sistema ahora incluye funcionalidad de superadmin que permite ver todas las conversaciones de todos los negocios en la plataforma.

## Características del Superadmin

- ✅ **Acceso Global**: Ve conversaciones de todos los negocios
- ✅ **Información del Negocio**: Muestra el nombre del negocio en cada conversación
- ✅ **Priorización de Escalaciones**: Mantiene el orden de prioridad de escalaciones
- ✅ **Compatibilidad**: Funciona con el sistema de roles existente

## Roles de Superadmin

Los siguientes roles tienen acceso de superadmin:

- `super_admin` - Rol dedicado para superadmin
- `admin` - Rol admin existente (mantiene compatibilidad)

## Configuración

### 1. Crear un Usuario Superadmin

Ejecuta el script de creación:

```bash
node scripts/create-superadmin.js
```

Esto creará:

- Un negocio "System Administration"
- Un usuario superadmin con credenciales:
  - Email: `superadmin@example.com`
  - Password: `superadmin123`

### 2. Crear Superadmin Manualmente

Si prefieres crear el superadmin manualmente:

1. **Crear un negocio** en la tabla `businesses`
2. **Crear un usuario** en `auth.users` con `role: 'super_admin'` en metadata
3. **Crear el perfil** en `users` con `role: 'super_admin'` y el `businessId`

### 3. Asignar Rol Superadmin a Usuario Existente

Para convertir un usuario existente en superadmin:

```sql
UPDATE users
SET role = 'super_admin'
WHERE email = 'tu-email@ejemplo.com';
```

## Uso

### Acceso a Conversaciones Globales

1. Inicia sesión con un usuario superadmin
2. Navega a `/protected`
3. Verás todas las conversaciones de todos los negocios
4. Cada conversación mostrará el nombre del negocio

### Diferencias en la Interfaz

**Para Superadmin:**

- Lista de conversaciones incluye nombre del negocio
- Puede ver conversaciones de cualquier negocio
- Mantiene priorización de escalaciones global

**Para Usuarios Regulares:**

- Solo ven conversaciones de su propio negocio
- Interfaz sin cambios

## Estructura Técnica

### Nuevos Métodos

- `ChatSession.getAllBusinessesConversationsData()` - Obtiene conversaciones de todos los negocios
- `SUPERADMIN_ROLES` - Constante que define roles de superadmin

### Cambios en la Base de Datos

- Agregado `superadmin` al tipo `UserRole`
- No se requieren cambios en el esquema de la base de datos

### Componentes Actualizados

- `ChatInterface` - Detecta rol de superadmin
- `ChatList` - Muestra información del negocio
- `Conversation` - Interfaz extendida con campos opcionales

## Seguridad

- Los superadmins usan el mismo sistema de autenticación
- Las políticas RLS existentes se mantienen
- El acceso se verifica en cada solicitud
- Solo usuarios con roles `super_admin` o `admin` tienen acceso global

## Troubleshooting

### Error: "Could not load user data"

- Verifica que el usuario existe en la tabla `users`
- Confirma que el campo `role` está configurado correctamente

### No se ven conversaciones de otros negocios

- Verifica que el usuario tiene rol `super_admin` o `admin`
- Confirma que existen conversaciones en otros negocios

### Error en la consulta de base de datos

- Verifica que la relación `businesses` existe en `chatSessions`
- Confirma que las políticas RLS permiten acceso al service role

## Mantenimiento

### Agregar Nuevos Superadmins

1. Usar el script de creación
2. O asignar manualmente el rol `super_admin`
3. Verificar que el usuario puede acceder a `/protected`

### Remover Acceso de Superadmin

```sql
UPDATE users
SET role = 'provider'
WHERE email = 'usuario@ejemplo.com';
```

### Monitoreo

- Los superadmins aparecen en logs con su rol
- Se puede monitorear el acceso global en logs de aplicación
- Considerar auditoría para acciones de superadmin
