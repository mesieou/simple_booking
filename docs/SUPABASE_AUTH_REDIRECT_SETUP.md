# Configuración de Redirecciones de Autenticación en Supabase

## Problema

Cuando creas una cuenta en Supabase, el enlace de redirección te envía a `localhost` en lugar de tu dominio de producción.

## Solución

### 1. Configurar Variables de Entorno

Asegúrate de tener la variable `NEXT_PUBLIC_SITE_URL` configurada en tu archivo `.env.local`:

```bash
# Para desarrollo local
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Para producción
NEXT_PUBLIC_SITE_URL=https://skedy.io
```

### 2. Configurar Supabase Dashboard

#### Paso 1: Acceder al Dashboard

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto

#### Paso 2: Configurar URLs de Autenticación

1. Ve a **Authentication** → **URL Configuration**
2. En **Site URL**, configura:
   - **Desarrollo**: `http://localhost:3000`
   - **Producción**: `https://skedy.io`

#### Paso 3: Configurar Redirect URLs

En la sección **Redirect URLs**, agrega las siguientes URLs:

**Para Desarrollo:**

```
http://localhost:3000/auth/callback
http://localhost:3000/api/auth/callback
http://localhost:3000/protected/reset-password
```

**Para Producción:**

```
https://skedy.io/auth/callback
https://skedy.io/api/auth/callback
https://skedy.io/protected/reset-password
```

### 3. Verificar Configuración

Después de configurar, puedes verificar que todo funciona:

1. Intenta crear una nueva cuenta
2. Verifica que el email de confirmación llegue
3. Haz clic en el enlace de confirmación
4. Deberías ser redirigido a tu sitio correcto

### 4. Troubleshooting

#### Si sigues siendo redirigido a localhost:

1. **Verifica las variables de entorno**:

   ```bash
   echo $NEXT_PUBLIC_SITE_URL
   ```

2. **Verifica la configuración en Supabase Dashboard**:

   - Asegúrate de que las URLs estén exactamente como se muestran arriba
   - No incluyas espacios extra o caracteres especiales

3. **Limpia el caché del navegador**:

   - Los enlaces de confirmación pueden estar cacheados

4. **Verifica los logs de Supabase**:
   - Ve a **Authentication** → **Logs** en el dashboard
   - Busca errores relacionados con redirecciones

### 5. Código Actualizado

El código ya ha sido actualizado para usar una configuración centralizada:

- `lib/config/auth-config.ts` - Configuración centralizada
- `app/actions.ts` - Acciones de autenticación actualizadas
- `app/(auth-pages)/sign-up/page.tsx` - Página de registro actualizada

### 6. Variables de Entorno Requeridas

Asegúrate de tener estas variables en tu `.env.local`:

```bash
# Configuración del sitio
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase (ya configuradas)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 7. Comandos Útiles

Para verificar la configuración actual:

```bash
# Verificar variables de entorno
node -e "console.log('Site URL:', process.env.NEXT_PUBLIC_SITE_URL || 'NOT SET')"

# Ejecutar script de verificación (si tienes las variables configuradas)
node scripts/check-supabase-auth-config.js
```

## Notas Importantes

- **Siempre configura tanto desarrollo como producción** en Supabase Dashboard
- **Las URLs deben coincidir exactamente** con las que usas en tu aplicación
- **Los cambios en Supabase Dashboard pueden tardar unos minutos** en propagarse
- **Para producción, asegúrate de usar HTTPS** en todas las URLs
