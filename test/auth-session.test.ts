import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { startTestServer, TestServer } from './helper/server';

// Tests del ciclo de sesion por HTTP: entrar, renovar y cerrar.
// Lo que se comprueba es el contrato que usan la app y el backoffice: codigos de estado, forma
// de la respuesta y, sobre todo, que al cerrar sesion los tokens que ya existian dejan de valer.

type Json = Record<string, any>;

interface Reply {
    status: number;
    body: Json | null;
}

const post = async (baseUrl: string, route: string, body: Json, token?: string): Promise<Reply> => {
    const response = await fetch(`${baseUrl}${route}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
    });
    const text = await response.text();

    return { status: response.status, body: text ? JSON.parse(text) : null };
};

const get = async (baseUrl: string, route: string, token: string): Promise<Reply> => {
    const response = await fetch(`${baseUrl}${route}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const text = await response.text();

    return { status: response.status, body: text ? JSON.parse(text) : null };
};

const EMAIL = `ana.${Date.now()}@example.com`;
const PASSWORD = 'seminari7-test';

let server: TestServer;
let session: Json;

before(async () => {
    server = await startTestServer();

    // El usuario se crea por HTTP, como en la vida real: el test no escribe en la base a mano
    const registered = await post(server.baseUrl, '/auth/register', {
        name: 'Ana',
        email: EMAIL,
        password: PASSWORD
    });

    assert.equal(registered.status, 201, `el registro tenia que crear el usuario: ${JSON.stringify(registered.body)}`);

    const logged = await post(server.baseUrl, '/auth/login', { email: EMAIL, password: PASSWORD });

    assert.equal(logged.status, 200, `el login de preparacion fallo: ${JSON.stringify(logged.body)}`);
    session = logged.body as Json;
});

after(async () => {
    await server.close();
});

describe('POST /auth/login', () => {
    it('devuelve los dos tokens y el usuario, y el usuario no lleva la contraseña', () => {
        assert.ok(session.token, 'falta el access token');
        assert.ok(session.refreshToken, 'falta el refresh token');
        assert.equal(session.user.email, EMAIL);
        assert.equal(session.user.password, undefined, 'la contraseña no puede salir en la respuesta');
    });

    it('con la contraseña incorrecta responde 401 y no devuelve tokens', async () => {
        const reply = await post(server.baseUrl, '/auth/login', { email: EMAIL, password: 'no-es-la-clave' });

        assert.equal(reply.status, 401);
        assert.equal(reply.body?.token, undefined);
        assert.equal(reply.body?.refreshToken, undefined);
    });
});

describe('POST /auth/refresh', () => {
    it('el access token renovado sirve para una ruta protegida', async () => {
        const renewed = await post(server.baseUrl, '/auth/refresh', { refreshToken: session.refreshToken });

        assert.equal(renewed.status, 200, `el refresco fallo: ${JSON.stringify(renewed.body)}`);

        const protectedRoute = await get(server.baseUrl, '/exercises', renewed.body!.token);

        assert.equal(protectedRoute.status, 200, 'el token renovado tenia que servir');
    });
});

describe('POST /auth/logout', () => {
    it('cierra la sesion y responde 204', async () => {
        const reply = await post(server.baseUrl, '/auth/logout', {}, session.token);

        assert.equal(reply.status, 204);
    });

    it('el access token que ya existia deja de servir en la siguiente peticion', async () => {
        const protectedRoute = await get(server.baseUrl, '/exercises', session.token);

        assert.equal(protectedRoute.status, 401, 'el access token tenia que quedar revocado');
        // El codigo es lo que mira el cliente para decidir que hay que volver a entrar
        assert.equal(protectedRoute.body?.code, 'SESSION_REVOKED');
    });

    it('el refresh token que ya existia tampoco sirve para pedir uno nuevo', async () => {
        const renewed = await post(server.baseUrl, '/auth/refresh', { refreshToken: session.refreshToken });

        assert.equal(renewed.status, 401, 'el refresh token tenia que quedar revocado');
        assert.equal(renewed.body?.code, 'SESSION_REVOKED');
    });
});
