import { ChildProcess, spawn } from 'child_process';
import net from 'net';
import path from 'path';

import { MongoMemoryServer } from 'mongodb-memory-server';

// Levanta una API de verdad para los tests: un Mongo propio en memoria y el servidor arrancado
// con tsx en un puerto libre. Los tests hablan por HTTP y no importan nada de src/, porque lo
// que se rompe en produccion es el contrato HTTP, no las funciones internas.
//
// El codigo de la aplicacion no se toca: el servidor es el mismo que se despliega, solo que con
// variables de entorno de test.

export interface TestServer {
    baseUrl: string;
    // Cierra el servidor y el Mongo. Se llama siempre, aunque un test falle
    close: () => Promise<void>;
}

const projectRoot = path.resolve(__dirname, '..', '..');

// Pide al sistema un puerto libre, para no chocar con el 1337 del desarrollo ni con otra corrida.
// Queda una carrera minima entre cerrar esta sonda y que el servidor pida el mismo numero:
// es la forma habitual de hacerlo sin meter en el codigo una opcion que solo usan los tests.
const freePort = () =>
    new Promise<number>((resolve, reject) => {
        const probe = net.createServer();

        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const address = probe.address();
            const port = typeof address === 'object' && address ? address.port : 0;

            probe.close(() => resolve(port));
        });
    });

// Espera a que la API conteste /ping. Si el proceso se cae antes, se para en el acto y devuelve
// lo que alcanzo a escribir: sin eso, un fallo de arranque se ve como 30 segundos de espera muda.
const waitForPing = async (baseUrl: string, child: ChildProcess, output: () => string) => {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`La API se cerro antes de arrancar (codigo ${child.exitCode}):\n${output()}`);
        }

        try {
            const response = await fetch(`${baseUrl}/ping`);

            if (response.ok) {
                return;
            }
        } catch {
            // Todavia no escucha: se reintenta
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(`La API no respondio en 30 segundos:\n${output()}`);
};

export const startTestServer = async (): Promise<TestServer> => {
    const mongo = await MongoMemoryServer.create();
    const port = await freePort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // Una base por corrida: nunca se roza la de desarrollo, y dos corridas a la vez no se pisan
    const mongoUrl = `${mongo.getUri()}spotter_test_${Date.now()}`;

    const child = spawn(process.execPath, ['--import', 'tsx', path.join('src', 'server.ts')], {
        cwd: projectRoot,
        env: {
            ...process.env,
            NODE_ENV: 'test',
            SERVER_PORT: String(port),
            MONGO_URL: mongoUrl,
            // Secretos de juguete: los tokens que se firman con ellos no valen fuera de estos tests
            JWT_SECRET: 'test-access-secret',
            JWT_REFRESH_SECRET: 'test-refresh-secret'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout?.on('data', (chunk) => (output += String(chunk)));
    child.stderr?.on('data', (chunk) => (output += String(chunk)));

    const close = async () => {
        if (child.exitCode === null) {
            child.kill('SIGTERM');
            await new Promise((resolve) => child.once('exit', resolve));
        }

        await mongo.stop();
    };

    try {
        await waitForPing(baseUrl, child, () => output);
    } catch (error) {
        await close();
        throw error;
    }

    return { baseUrl, close };
};
