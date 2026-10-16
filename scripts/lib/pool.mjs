export async function drain(items, workers, work) {
  const queue = [...items];
  const pool = typeof workers === 'number' ? Array.from({ length: workers }) : workers;
  await Promise.all(
    pool.map(async (worker) => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item, worker);
    }),
  );
}
