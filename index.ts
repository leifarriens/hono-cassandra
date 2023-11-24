import { Client } from 'cassandra-driver';
import { Hono } from 'hono';
import { prettyJSON } from 'hono/pretty-json';
import { serve } from '@hono/node-server';
import { etag } from 'hono/etag';
import { logger } from 'hono/logger';

const client = new Client({
  contactPoints: ['localhost'],
  localDataCenter: 'datacenter1',
  keyspace: 'test', // NOTE: remove from client when encountering "Keyspace does not exist" error
});

function createKeyspace() {
  const query = `CREATE KEYSPACE IF NOT EXISTS test WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}`;

  return client.execute(query);
}

function createTable() {
  const query = `
  CREATE TABLE IF NOT EXISTS users (
    id int PRIMARY KEY,
    name text,
    email text
  )
`;

  return client.execute(query);
}

const app = new Hono();

app.use('*', prettyJSON());
app.use('*', etag(), logger());

app.post('/', async (c) => {
  const body = await c.req.json();
  const params = [body.id, body.name, body.email];

  console.log(params);

  const query = `INSERT INTO users (id, name, email) VALUES (?, ?, ?)`;

  await client.execute(query, params, { prepare: true });

  c.status(201);
  return c.text('done');
});

app.get('/', async (c) => {
  const query = 'SELECT * FROM users';

  const { rows } = await client.execute(query);

  return c.json(rows);
});

app.get('/:id', async (c) => {
  const query = 'SELECT * FROM users WHERE id = ?';

  const id = parseInt(c.req.param('id'));

  const { rows, rowLength } = await client.execute(query, [id], {
    prepare: true,
  });

  if (rowLength === 0) {
    c.status(404);
    return c.json({ messag: 'Not found' });
  }

  return c.json(rows[0]);
});

async function main() {
  console.log(await createKeyspace());
  console.log('Created Keyspace');
  console.log(await createTable());
  console.log('Created Table');

  serve(app);
}

main();
