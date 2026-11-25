import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { setUserRole, startTestServer, TestServer } from './helper/server';

// Tests de permisos por HTTP: que un USER no pueda hacer lo que hace un ADMIN, que el perfil
// propio devuelva el rol, y que una rutina o un entrenamiento de otro no se pueda tocar.
// Son las reglas que ya se rompieron alguna vez en las tarjetas de este proyecto.

type Json = Record<string, any>;

interface Reply {
    status: number;
    body: any;
}

const call = async (baseUrl: string, method: string, route: string, token?: string, body?: Json): Promise<Reply> => {
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await response.text();

    return { status: response.status, body: text ? JSON.parse(text) : null };
};

const PASSWORD = 'seminari7-test';

let server: TestServer;
let ana: Json; // USER
let carla: Json; // USER, la otra dueña
let beto: Json; // USER ascendido a ADMIN

// Crea el usuario por HTTP y devuelve su sesión (token, refreshToken, user)
const createUser = async (name: string) => {
    const email = `${name.toLowerCase()}.${Date.now()}@example.com`;

    const registered = await call(server.baseUrl, 'POST', '/auth/register', undefined, { name, email, password: PASSWORD });

    assert.equal(registered.status, 201, `no se pudo registrar a ${name}: ${JSON.stringify(registered.body)}`);

    const logged = await call(server.baseUrl, 'POST', '/auth/login', undefined, { email, password: PASSWORD });

    assert.equal(logged.status, 200, `no se pudo entrar como ${name}: ${JSON.stringify(logged.body)}`);

    return logged.body as Json;
};

before(async () => {
    server = await startTestServer();

    ana = await createUser('Ana');
    carla = await createUser('Carla');
    beto = await createUser('Beto');

    // No hay ruta para ascender a nadie, y es a proposito: el ADMIN se crea por detras
    await setUserRole(server.mongoUrl, beto.user.email, 'ADMIN');
});

after(async () => {
    await server.close();
});

describe('GET /users', () => {
    it('un USER no puede listar usuarios', async () => {
        const reply = await call(server.baseUrl, 'GET', '/users', ana.token);

        assert.equal(reply.status, 403);
    });

    it('un ADMIN sí, y la lista no lleva contraseñas', async () => {
        const reply = await call(server.baseUrl, 'GET', '/users', beto.token);

        assert.equal(reply.status, 200, `la lista falló: ${JSON.stringify(reply.body)}`);

        const users = reply.body.users ?? reply.body;
        const list = Array.isArray(users) ? users : users.items;

        assert.ok(Array.isArray(list) && list.length >= 3, 'la lista tenía que traer a los tres usuarios');
        for (const user of list) {
            assert.equal(user.password, undefined, 'la contraseña no puede salir en la lista');
        }
    });
});

describe('GET /users/me', () => {
    it('devuelve el perfil propio con el rol que se lee de la base', async () => {
        const own = await call(server.baseUrl, 'GET', '/users/me', ana.token);

        assert.equal(own.status, 200);
        assert.equal(own.body.user.email, ana.user.email);
        assert.equal(own.body.user.role, 'USER');

        // Beto se ascendió después de entrar: el rol tiene que salir de la base, no del token
        const admin = await call(server.baseUrl, 'GET', '/users/me', beto.token);

        assert.equal(admin.status, 200);
        assert.equal(admin.body.user.role, 'ADMIN', 'el rol tenía que reflejar el ascenso sin volver a entrar');
    });

    it('un USER no puede ver el detalle de otro usuario', async () => {
        const reply = await call(server.baseUrl, 'GET', `/users/${carla.user._id}`, ana.token);

        assert.equal(reply.status, 403);
    });
});

describe('las rutinas del dueño', () => {
    let anaWorkoutId: string;

    it('cada usuario crea su rutina y la ve en su propia lista', async () => {
        const created = await call(server.baseUrl, 'POST', '/users/me/workouts', ana.token, { name: 'Pierna' });

        assert.equal(created.status, 201, `no se creó la rutina: ${JSON.stringify(created.body)}`);
        anaWorkoutId = created.body.workout?._id ?? created.body._id;
        assert.ok(anaWorkoutId, 'la respuesta tenía que traer el id de la rutina');

        const own = await call(server.baseUrl, 'GET', '/users/me/workouts', ana.token);

        assert.equal(own.status, 200);
        const mine = (own.body.workouts ?? []).map((workout: Json) => String(workout._id));
        assert.ok(mine.includes(String(anaWorkoutId)), 'la rutina tenía que estar en la lista de su dueña');

        const other = await call(server.baseUrl, 'GET', '/users/me/workouts', carla.token);
        const hers = (other.body.workouts ?? []).map((workout: Json) => String(workout._id));

        assert.ok(!hers.includes(String(anaWorkoutId)), 'la rutina de Ana no puede salir en la lista de Carla');
    });

    it('el dueño puede modificar la suya', async () => {
        const reply = await call(server.baseUrl, 'PUT', `/workouts/${anaWorkoutId}`, ana.token, { name: 'Pierna y glúteo' });

        assert.equal(reply.status, 200, `la dueña tenía que poder modificarla: ${JSON.stringify(reply.body)}`);
    });

    it('otro USER recibe 404, no 403: no se le revela que la rutina existe', async () => {
        const reply = await call(server.baseUrl, 'PUT', `/workouts/${anaWorkoutId}`, carla.token, { name: 'Secuestrada' });

        assert.equal(reply.status, 404);
    });

    it('un ADMIN sí puede modificarla', async () => {
        const reply = await call(server.baseUrl, 'PUT', `/workouts/${anaWorkoutId}`, beto.token, { name: 'Pierna (admin)' });

        assert.equal(reply.status, 200, `el ADMIN tenía que poder: ${JSON.stringify(reply.body)}`);
    });
});

describe('los entrenamientos del dueño', () => {
    let anaSessionId: string;

    it('el entrenamiento de uno no aparece en la lista del otro', async () => {
        const created = await call(server.baseUrl, 'POST', '/users/me/sessions', ana.token, {
            startedAt: '2026-11-17T18:00:00.000Z',
            finishedAt: '2026-11-17T19:05:00.000Z'
        });

        assert.equal(created.status, 201, `no se creó el entrenamiento: ${JSON.stringify(created.body)}`);
        anaSessionId = created.body.session?._id ?? created.body._id;
        assert.ok(anaSessionId, 'la respuesta tenía que traer el id del entrenamiento');

        const hers = await call(server.baseUrl, 'GET', '/users/me/sessions', carla.token);
        const list = (hers.body.sessions ?? hers.body.results ?? []).map((session: Json) => String(session._id));

        assert.equal(hers.status, 200);
        assert.ok(!list.includes(String(anaSessionId)), 'el entrenamiento de Ana no puede salir en la lista de Carla');
    });
});
