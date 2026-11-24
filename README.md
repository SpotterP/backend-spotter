# EA-Proyecto-Backend

## Instalar las dependencias

```
npm install
```

Antes de arrancar, copia la plantilla de variables de entorno. Sin `JWT_SECRET` y `JWT_REFRESH_SECRET` la API
no arranca:

```
cp .env.example .env
```

## Ejecutar

Mientras programas, arranca la API en modo desarrollo; se reinicia sola cada vez que guardas un archivo:

```
npm run dev
```

Comprueba que responde en <http://localhost:1337/ping> (debe devolver `{"hello":"world"}`). La
documentación de la API está en <http://localhost:1337/api-docs>.

Para ejecutar la versión compilada, como en un servidor:

```
npm run build
npm start
```

`npm run build` compila de TypeScript a JavaScript en `build/`. Si cambias el código, vuelve a ejecutarlo
antes de `npm start`.

Para analizar el código con Oxlint (solo `src/`, porque `build/` es código generado):

```
npm run lint
```

Y para aplicar las correcciones automáticas que tenga:

```
npm run lint:fix
```

### Hook de Git: linter antes de cada commit

Al hacer `npm install` se activa solo un hook de Git (`.githooks/pre-commit`, lo configura el script `prepare`).
Antes de cada `git commit` pasa `npm run lint`: si el linter encuentra un error, el commit se cancela y dice qué arreglar.
Si hace falta, se puede saltar una vez con `git commit --no-verify`, pero lo normal es arreglar el aviso.

## Despliegue en producción con HTTPS (Docker)

La pila de producción está en `docker-compose.yml` y levanta cuatro contenedores:

| Servicio | Qué es |
|---|---|
| `caddy` | Proxy que pone el HTTPS: pide y renueva los certificados de Let's Encrypt, y redirige `http` a `https`. Es el único que publica puertos (80 y 443). |
| `web` | La web ([webapp-spotter](https://github.com/SpotterP/webapp-spotter)), construida desde su rama `dev` con la dirección de la API ya dentro. |
| `api` | Esta API (el `Dockerfile` de esta carpeta). Socket.IO sale por el mismo puerto. |
| `mongo` | MongoDB, con los datos en un volumen. No se publica fuera de Docker. |

### Qué hace falta
- Un servidor con **Docker** y **Docker Compose**, y los puertos **80 y 443** abiertos.
- Dos registros DNS de tipo A, uno para la web (`spotter.tudominio.com`) y otro para la API (`api.spotter.tudominio.com`), apuntando a la IP del servidor. Sin esto Let's Encrypt no puede dar el certificado.

### Arrancar

```bash
cp .env.production.example .env.production      # y rellenar el dominio, el correo y los secretos JWT
docker compose --env-file .env.production up -d --build
docker compose exec api node build/seed.js      # solo la primera vez: usuarios, ejercicios y rutinas de ejemplo
```

La web queda en `https://<DOMAIN>` y la API en `https://<API_DOMAIN>`. El primer arranque tarda un poco más, porque Caddy pide los certificados.
Los certificados se renuevan solos y se guardan en el volumen `caddy_data`.

Otras órdenes útiles:

```bash
docker compose ps                  # estado de los contenedores
docker compose logs -f api         # logs de la API (o caddy, web, mongo)
docker compose --env-file .env.production up -d --build   # actualizar después de un git pull
docker compose down                # apagar (los datos se conservan; con -v se borran)
```

### La app móvil
La app Flutter apunta a la API con `--dart-define`: `flutter run --dart-define=API_URL=https://api.spotter.tudominio.com`.

### Probarlo sin dominio
Con `DOMAIN=localhost` y `API_DOMAIN=api.localhost` Caddy genera certificados locales, así se puede comprobar el HTTPS en un ordenador sin dominio (el navegador avisará de que el certificado no es de confianza).
La prueba automática de GitHub Actions (`.github/workflows/https-stack.yml`) hace dos comprobaciones en cada PR que toca la pila:

1. **La pila con HTTPS local:** levanta todo con `localhost` y `api.localhost`, y comprueba la web, la redirección a https, la API con su CORS, el login y el Socket.IO.
2. **Los certificados por ACME:** levanta la pila con los nombres `spotter.test` y `api.spotter.test` y con Pebble, el servidor de pruebas de Let's Encrypt, y comprueba que Caddy pide y recibe un certificado por cada dominio con el mismo `Caddyfile` de producción.

Lo único que no se puede probar sin un servidor es el Let's Encrypt real: el DNS apuntando al servidor y los puertos 80 y 443 abiertos.

## Endpoints

Todo salvo `/auth/*`, `/ping` y `/api-docs` pide el token en la cabecera `Authorization: Bearer <token>`.

| Método | Ruta | Quién puede | Qué hace |
|---|---|---|---|
| POST | `/auth/register` | cualquiera | Crea un usuario `USER`: 201 `{ user }`, sin token |
| POST | `/auth/login` | cualquiera | Devuelve `{ token, refreshToken, user }` o 401 |
| POST | `/auth/admin/login` | solo `ADMIN` | Login del backoffice: 200 igual que `/auth/login`, 401 si las credenciales no son correctas, 403 si el usuario no es `ADMIN` |
| POST | `/auth/refresh` | su refresh token | Devuelve un `{ token }` nuevo o 401 |
| GET | `/users` | cualquier sesión | Lista de usuarios: solo `_id` y `name`. Un `ADMIN` ve todos; el resto, solo los activos |
| POST | `/users` | `ADMIN` | Crea un usuario: 201 `{ user }` |
| GET | `/users/:userId` | `ADMIN` | Devuelve `{ user }` o 404 |
| PUT | `/users/:userId` | `ADMIN` | Actualiza el usuario; devuelve `{ user }` y 404 si no existe |
| DELETE | `/users/:userId` | `ADMIN` | Borrado lógico (`isDeleted`): 204 o 404. Un admin no puede borrarse a sí mismo |
| PATCH | `/users/:userId/restore` | `ADMIN` | Recupera el usuario borrado (`isDeleted: false`): 200 o 404; 409 si ya hay otro activo con el mismo nombre/email |
| DELETE | `/users/:userId/hard` | `ADMIN` | Borrado definitivo de la base de datos: 204 o 404 |
| GET | `/exercises` | cualquier sesión | Lista paginada de ejercicios, con buscador y filtro por categoría. Un `ADMIN` ve todos; el resto, solo los activos |
| POST | `/exercises` | `ADMIN` | Crea un ejercicio: 201 `{ exercise }` |
| GET | `/exercises/:exerciseId` | cualquier sesión | Devuelve `{ exercise }` o 404. Si el ejercicio está borrado, 404 para quien no es `ADMIN` |
| PUT | `/exercises/:exerciseId` | `ADMIN` | Actualiza el ejercicio; devuelve `{ exercise }` y 404 si no existe o está borrado |
| DELETE | `/exercises/:exerciseId` | `ADMIN` | Borrado lógico (`isDeleted`): 204 o 404 |
| PATCH | `/exercises/:exerciseId/restore` | `ADMIN` | Recupera el ejercicio borrado (`isDeleted: false`): 200 o 404; 409 si ya hay otro activo con el mismo nombre/email |
| DELETE | `/exercises/:exerciseId/hard` | `ADMIN` | Borrado definitivo; lo quita también de las rutinas: 204 o 404 |
| GET | `/workouts` | cualquier sesión | Lista paginada de rutinas, con buscador y filtro por día. Un `ADMIN` ve todas; el resto, solo las activas |
| POST | `/workouts` | `ADMIN` | Crea una rutina: 201 `{ workout }` |
| GET | `/workouts/:workoutId` | cualquier sesión | Devuelve `{ workout }` con sus ejercicios completos. Si la rutina está borrada, 404 para quien no es `ADMIN` |
| PUT | `/workouts/:workoutId` | `ADMIN` | Actualiza la rutina; devuelve `{ workout }` y 404 si no existe o está borrada |
| DELETE | `/workouts/:workoutId` | `ADMIN` | Borrado lógico (`isDeleted`): 204 o 404 |
| PATCH | `/workouts/:workoutId/restore` | `ADMIN` | Recupera la rutina borrado (`isDeleted: false`): 200 o 404; 409 si ya hay otro activo con el mismo nombre/email |
| DELETE | `/workouts/:workoutId/hard` | `ADMIN` | Borrado definitivo de la base de datos: 204 o 404 |
| GET | `/ping` | cualquiera | Healthcheck: `{ hello: 'world' }` |

### Quién ve qué

Los listados de ejercicios, rutinas y usuarios, y el detalle de ejercicios y rutinas, son la misma ruta
para todo el mundo; lo que cambia es el contenido según el rol que va dentro del token:

- **`ADMIN`**: consulta todo, también los elementos borrados (`isDeleted: true`).
- **Cualquier otra sesión**: solo los elementos **activos**. Un elemento borrado no sale en los listados y su
  detalle responde 404, como si no existiera.

Un elemento está **activo** cuando su campo `isDeleted` es `false`. El borrado es siempre lógico: el documento
sigue en MongoDB con `isDeleted: true` y `deletedAt` con la fecha, y se puede recuperar con `PATCH /:id/restore` (`isDeleted` vuelve a `false`).
Las escrituras (`POST` y `PUT`) son solo de `ADMIN`.

Sin sesión, cualquier ruta salvo `/auth/*`, `/ping` y `/api-docs` responde 401: el token se comprueba antes de
mirar el rol, y un rol insuficiente responde 403. Un usuario borrado tampoco puede entrar: `POST /auth/login`
y `POST /auth/refresh` responden 401 con sus credenciales, como si no existiera.

Los cuerpos que se envían:

- **Ejercicios** (catálogo): `name` y `category` (una de `CHEST`, `BACK`, `LEGS`, `SHOULDERS`, `ARMS`, `CORE`, `CARDIO`).
- **Rutinas**: `name`, `description` (opcional), `days` (lista de `MONDAY` a `SUNDAY`, puede estar vacía) y
  `exercises`, una lista de `{ exercise, sets, reps }`: el id del ejercicio del catálogo y sus series y repeticiones
  en esa rutina. El orden de la lista es el orden de la rutina, y al leer cada `exercise` sale como objeto completo.
  Cada rutina tiene un dueño (`owner`) y el nombre es único por usuario.
- **Mis rutinas** (rol USER): `GET` y `POST /users/me/workouts`, y `GET`, `PUT` y `DELETE`
  `/users/me/workouts/:workoutId`. Cada usuario solo ve y toca las suyas; una rutina de otro responde 404.
- **Usuarios**: `name`, `email`, `password` (8 caracteres como mínimo) y `role` (`ADMIN` o `USER`).

## Tiempo real (Socket.IO)

La API avisa en tiempo real cuando un usuario guarda un entrenamiento. Socket.IO va sobre el mismo servidor y el mismo puerto que la API.
Swagger no documenta los sockets, así que se explica aquí.

- **Conexión:** hay que enviar el access token en el handshake, `io(url, { auth: { token } })`. Sin token, o con uno caducado o falso, la conexión se rechaza con un error.
- **Sala:** al conectar, cada usuario entra en su sala personal `user:<id>`. Solo recibe sus propios avisos.
- **Evento `session:created`:** lo recibe el usuario cuando guarda un entrenamiento con `POST /users/me/sessions`. Trae el entrenamiento guardado.
  Si el usuario no tiene ninguna conexión abierta, el entrenamiento se guarda igual (201).

Ejemplo de cliente (con `socket.io-client`):

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:1337', { auth: { token } });

socket.on('session:created', (session) => console.log('Entrenamiento nuevo', session));
socket.on('connect_error', (error) => console.log('No se pudo conectar:', error.message));
```

## Estructura del proyecto

```
src/
  server.ts        Punto de entrada: conecta con MongoDB, registra middleware y rutas, y arranca el servidor
  socket.ts        Socket.IO: crea el servidor de sockets, una sala por usuario y emitToUser()
  seed.ts          Script que llena la base de datos con los datos de ejemplo
  migrate-roles.ts Script de una sola vez: pasa los roles antiguos (admin, user) a ADMIN y USER
  seed-data.ts     Los datos de ejemplo: usuarios, ejercicios y rutinas
  config/
    config.ts        Lee las variables de entorno y las reúne en un objeto config
    swagger.ts       Monta el documento de Swagger con los esquemas de Joi y las rutas
  library/
    Logging.ts       Mensajes de consola con fecha y color (info, warning, error)
  routes/          El mapa de URLs: qué petición va a qué controlador
    Auth.ts, Users.ts, Exercise.ts, Workout.ts
  controllers/     Leen la petición (req), llaman al servicio y eligen la respuesta (res)
    Auth.ts, Users.ts, Exercise.ts, Workout.ts
  services/        Leen y escriben en la base de datos a través de los modelos. No saben que existe HTTP
    AuthService.ts, UserService.ts, ExerciseService.ts, WorkoutService.ts
  models/          Esquemas de Mongoose: qué campos tiene cada documento y de qué tipo
    User.ts, Exercise.ts, Workout.ts
  middleware/      Lo que se ejecuta entre la ruta y el controlador
    VerifyToken.ts   Comprueba el token de la cabecera Authorization y deja el usuario en req.user (401)
    RequireRole.ts   Deja pasar solo a un rol concreto (403)
    Joi.ts           Guardas: validan el body (422) y el id de la URL (400)
    SocketAuth.ts    Comprueba el token en la conexion de Socket.IO y la rechaza si no vale
    Cors.ts          Cabeceras de CORS, configuradas con CORS_ORIGIN
    Logger.ts        Escribe en consola cada petición y su código de respuesta
    ErrorHandler.ts  Convierte cualquier error en su código: 400, 401, 404, 409, 422 o 500
  types/           Tipos compartidos: el payload de los tokens, y req.user de Express
  utils/
    password.ts      Cifra y comprueba contraseñas con scrypt
```
